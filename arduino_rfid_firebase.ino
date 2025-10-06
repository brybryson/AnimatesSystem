#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <time.h>
#include <map>
#include <Preferences.h>
#include <esp_task_wdt.h>

Preferences preferences;

// WiFi credentials array for fallback connections
struct WiFiCredentials {
  const char* ssid;
  const char* password;
};

WiFiCredentials wifiList[] = {
  {"Shiva", "ayawkonga"},
  {"Iverson", "pahingibentepls"},
  {"PLDTHOMEFIBRc11f8", "PLDTWIFIg9y9y"}
};
const int numWiFiNetworks = sizeof(wifiList) / sizeof(wifiList[0]);

// Firestore Configuration - Direct REST API (NO AUTH NEEDED)
const char* FIRESTORE_PROJECT_ID = "animatesrfid";
const char* FIRESTORE_API_KEY = "AIzaSyBCqI4oN_ikpKRxeRSaCaopCnCCmBImZqA";
const char* FIRESTORE_COLLECTION = "rfid_taps";

// Pin Definitions
#define SS_PIN 21
#define RST_PIN 22
#define BUZZER_PIN 17
#define LED_PIN 2

// RFID Scanner
MFRC522 rfid(SS_PIN, RST_PIN);

// Card tracking
std::map<String, int> cardTaps;
std::map<String, String> cardUIDs;

// Timing variables
unsigned long cardHoldStart = 0;
String currentCard = "";
bool cardValidated = false;
bool scanningDisabled = false;
unsigned long disableStart = 0;

const int MAX_TAPS = 3;
const unsigned long HOLD_TIME = 3000;
const unsigned long DISABLE_TIME = 5000;

// Document counter
int docCounter = 1;

// WiFi health monitoring
unsigned long lastWiFiCheck = 0;
int consecutiveWiFiFailures = 0;

// Time configuration
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 28800; // GMT+8 for Philippines
const int daylightOffset_sec = 0;
bool timeInitialized = false;

// Card detection debouncing
unsigned long lastCardDetection = 0;
const unsigned long DEBOUNCE_TIME = 500;

// Add queue for failed uploads
struct FailedUpload {
    String cardUID;
    String customUID;
    int tapCount;
    String timestamp;
    unsigned long attemptTime;
};

std::vector<FailedUpload> failedUploads;
const int MAX_FAILED_UPLOADS = 10;

// Configuration structure
struct DeviceConfig {
    int maxTaps;
    unsigned long validationTime;
    unsigned long disableTime;
    unsigned long cardTimeout;
};

DeviceConfig config = {
    .maxTaps = 3,
    .validationTime = 3000,
    .disableTime = 5000,
    .cardTimeout = 2000
};

void debugWiFiStatus() {
  Serial.println("========== WiFi Debug Info ==========");
  Serial.println("WiFi Status: " + String(WiFi.status()));
  Serial.println("WiFi Mode: " + String(WiFi.getMode()));
  Serial.println("MAC Address: " + WiFi.macAddress());
  
  Serial.println("Scanning for networks...");
  int n = WiFi.scanNetworks();
  if (n > 0) {
    for (int i = 0; i < n; i++) {
      Serial.printf("%d: %s (%d dBm) %s\n", 
                    i + 1, 
                    WiFi.SSID(i).c_str(), 
                    WiFi.RSSI(i),
                    (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Encrypted");
    }
  } else {
    Serial.println("No networks found");
  }
  WiFi.scanDelete();
  Serial.println("====================================");
}

void connectWiFi() {
  Serial.println("Initializing WiFi connection...");
  
  WiFi.mode(WIFI_OFF);
  delay(2000);
  
  WiFi.persistent(false);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  delay(2000);
  
  debugWiFiStatus();
  
  for (int i = 0; i < numWiFiNetworks; i++) {
    Serial.printf("Attempting connection to: %s\n", wifiList[i].ssid);
    
    WiFi.mode(WIFI_STA);
    delay(1000);
    
    WiFi.disconnect();
    delay(1000);
    
    WiFi.begin(wifiList[i].ssid, wifiList[i].password);
    Serial.println("Connection initiated...");
    
    int attempts = 0;
    
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
      delay(500);
      Serial.print(".");
      attempts++;
      
      if (attempts % 10 == 0) {
        Serial.println();
        Serial.printf("Status after %d seconds: %d\n", attempts/2, WiFi.status());
      }
      
      if (WiFi.status() == WL_NO_SSID_AVAIL || WiFi.status() == WL_CONNECT_FAILED) {
        break;
      }
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println();
      Serial.println("*** CONNECTION SUCCESSFUL! ***");
      Serial.printf("Connected to: %s\n", wifiList[i].ssid);
      Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("Signal Strength: %d dBm\n", WiFi.RSSI());
      
      consecutiveWiFiFailures = 0;
      return;
    } else {
      Serial.println();
      Serial.printf("Failed to connect to: %s\n", wifiList[i].ssid);
      WiFi.disconnect(true);
      delay(3000);
    }
  }
  
  Serial.println("ERROR: Could not connect to any WiFi network!");
  consecutiveWiFiFailures++;
  
  if (consecutiveWiFiFailures >= 3) {
    Serial.println("Too many failures. Restarting ESP32 in 10 seconds...");
    delay(10000);
    ESP.restart();
  } else {
    Serial.println("Retrying all networks in 15 seconds...");
    delay(15000);
    connectWiFi();
  }
}

void checkWiFiHealth() {
  if (millis() - lastWiFiCheck > 30000) {
    lastWiFiCheck = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      consecutiveWiFiFailures++;
      Serial.println("WiFi disconnected. Attempt " + String(consecutiveWiFiFailures));
      
      if (consecutiveWiFiFailures >= 3) {
        Serial.println("Reconnecting to WiFi...");
        WiFi.disconnect(true, true);
        delay(3000);
        connectWiFi();
        consecutiveWiFiFailures = 0;
      }
    } else {
      consecutiveWiFiFailures = 0;
      Serial.println("WiFi: " + WiFi.SSID() + " | Signal: " + String(WiFi.RSSI()) + " dBm");
    }
  }
}

void clearAllStoredData() {
  Serial.println("========================================");
  Serial.println("CLEARING ALL STORED CARD DATA");
  Serial.println("========================================");
  
  cardTaps.clear();
  cardUIDs.clear();
  preferences.clear();
  
  Serial.println("All stored card data has been cleared!");
  Serial.println("Device reset to factory state");
  Serial.println("========================================");
  
  for(int i = 0; i < 5; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}

void quickTimeSetup() {
  Serial.println("Configuring time with NTP server (5 second max)...");
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  
  struct tm timeinfo;
  int attempts = 0;
  
  while (!getLocalTime(&timeinfo) && attempts < 5) {
    Serial.print(".");
    delay(1000);
    attempts++;
  }
  
  if (getLocalTime(&timeinfo)) {
    Serial.println();
    Serial.println("Time synchronized successfully!");
    char timeString[64];
    strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.println("Current time: " + String(timeString));
    timeInitialized = true;
  } else {
    Serial.println();
    Serial.println("NTP sync timeout - using system timestamps");
    timeInitialized = false;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================");
  Serial.println("ESP32 RFID to Firestore (Enhanced)");
  Serial.println("Configuration: 3 TAPS MAXIMUM");
  Serial.println("========================================\n");
  
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  
  // Enable watchdog timer
  esp_task_wdt_config_t twdt_config = {
    .timeout_ms = 60000,
    .idle_core_mask = (1 << 0),
    .trigger_panic = true
  };
  esp_task_wdt_deinit();
  esp_task_wdt_init(&twdt_config);
  esp_task_wdt_add(NULL);
  
  preferences.begin("rfid_data", false);
  clearAllStoredData();
  
  connectWiFi();
  quickTimeSetup();
  
  SPI.begin();
  rfid.PCD_Init();
  
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  if ((version == 0x00) || (version == 0xFF)) {
    Serial.println("WARNING: RFID Scanner communication failed!");
    beep(5);
  } else {
    Serial.println("RFID Scanner connected successfully!");
  }
  
  rfid.PCD_DumpVersionToSerial();
  
  Serial.println("========================================");
  Serial.println("RFID READER READY!");
  Serial.println("Hold card for 3 seconds to scan");
  Serial.println("Maximum 3 taps per service cycle");
  Serial.println("========================================\n");
  beep(2);
}

void loop() {
  esp_task_wdt_reset();
  checkWiFiHealth();
  
  static unsigned long lastRetryTime = 0;
  if (millis() - lastRetryTime > 30000) {
    lastRetryTime = millis();
    retryFailedUploads();
  }
  
  if (scanningDisabled && (millis() - disableStart >= DISABLE_TIME)) {
    scanningDisabled = false;
    currentCard = "";
    cardValidated = false;
    Serial.println("Scanner re-enabled\n");
    beep(1);
  }
  
  if (scanningDisabled) {
    delay(500);
    return;
  }
  
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(100);
    return;
  }
  
  unsigned long currentTime = millis();
  if (currentTime - lastCardDetection < DEBOUNCE_TIME) {
    delay(100);
    return;
  }
  
  lastCardDetection = currentTime;
  
  String cardID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) cardID += "0";
    cardID += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) cardID += ":";
  }
  cardID.toUpperCase();
  
  if (cardID != currentCard) {
    currentCard = cardID;
    cardHoldStart = millis();
    cardValidated = false;
    Serial.println("Card detected: " + cardID);
    Serial.println("Hold for 3 seconds...");
    beep(1);
  }
  
  unsigned long holdDuration = millis() - cardHoldStart;
  
  if (holdDuration >= HOLD_TIME && !cardValidated) {
    cardValidated = true;
    Serial.println("\n*** CARD VALIDATED ***");
    
    processCard(cardID);
    
    scanningDisabled = true;
    disableStart = millis();
    
    beep(3);
  }
  
  delay(200);
}

void processCard(String cardID) {
  String customUID = getCustomUID(cardID);
  
  int tapCount = cardTaps[cardID];
  tapCount++;
  
  if (tapCount > MAX_TAPS) {
    tapCount = 1;
    customUID = generateUID(cardID + String(millis()));
    cardUIDs[cardID] = customUID;
    Serial.println("Card completed 3-tap cycle! New CustomUID generated: " + customUID);
  }
  cardTaps[cardID] = tapCount;
  
  Serial.println("Card: " + cardID);
  Serial.println("Custom UID: " + customUID);
  Serial.println("Tap: " + String(tapCount) + "/" + String(MAX_TAPS));
  
  sendToFirestore(cardID, customUID, tapCount);
}

String getCustomUID(String cardID) {
  if (cardUIDs.find(cardID) == cardUIDs.end()) {
    cardUIDs[cardID] = generateUID(cardID);
  }
  return cardUIDs[cardID];
}

String generateUID(String seed) {
  unsigned long hash = 0;
  for (int i = 0; i < seed.length(); i++) {
    hash = hash * 31 + seed.charAt(i);
  }
  
  randomSeed(hash);
  String uid = "";
  const char chars[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  
  for (int i = 0; i < 8; i++) {
    uid += chars[random(0, 36)];
  }
  
  return uid;
}

String getRFIDStatus() {
  byte version = rfid.PCD_ReadRegister(rfid.VersionReg);
  if ((version == 0x00) || (version == 0xFF)) {
    return "ERROR";
  } else {
    return "OK";
  }
}

void sendToFirestore(String cardID, String customUID, int tapCount) {
  Serial.println("\n=== SENDING TO FIRESTORE ===");
  
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected!");
    addFailedUpload(cardID, customUID, tapCount);
    beep(5);
    return;
  }
  
  String timestamp = getDateTime();
  String docName = getNextDocName();
  
  String url = "https://firestore.googleapis.com/v1/projects/" + 
               String(FIRESTORE_PROJECT_ID) + 
               "/databases/(default)/documents/" + 
               String(FIRESTORE_COLLECTION) + 
               "/" + docName + 
               "?key=" + String(FIRESTORE_API_KEY);
  
  String payload = "{\"fields\": {";
  payload += "\"card_uid\": {\"stringValue\": \"" + cardID + "\"},";
  payload += "\"custom_uid\": {\"stringValue\": \"" + customUID + "\"},";
  payload += "\"tap_count\": {\"integerValue\": \"" + String(tapCount) + "\"},";
  payload += "\"max_taps\": {\"integerValue\": \"" + String(MAX_TAPS) + "\"},";
  payload += "\"tap_number\": {\"integerValue\": \"" + String(tapCount) + "\"},";
  payload += "\"timestamp\": {\"stringValue\": \"" + timestamp + "\"},";
  payload += "\"device\": {\"stringValue\": \"ESP32-RFID\"},";
  payload += "\"device_info\": {\"stringValue\": \"ESP32-RFID-Scanner\"},";
  payload += "\"wifi_ssid\": {\"stringValue\": \"" + WiFi.SSID() + "\"},";
  payload += "\"wifi_network\": {\"stringValue\": \"" + WiFi.SSID() + "\"},";
  payload += "\"signal_strength\": {\"integerValue\": \"" + String(WiFi.RSSI()) + "\"},";
  payload += "\"validation_status\": {\"stringValue\": \"approved\"},";
  payload += "\"readable_time\": {\"stringValue\": \"" + timestamp + "\"},";
  payload += "\"timestamp_value\": {\"stringValue\": \"" + timestamp + "\"},";
  payload += "\"rfid_scanner_status\": {\"stringValue\": \"" + getRFIDStatus() + "\"},";
  payload += "\"validation_time_ms\": {\"integerValue\": \"" + String(HOLD_TIME) + "\"}";
  payload += "}}";
  
  Serial.println("Document: " + docName);
  Serial.println("Payload: " + payload);
  
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000);
  
  int maxRetries = 3;
  int httpCode = 0;
  
  for (int attempt = 1; attempt <= maxRetries; attempt++) {
    Serial.println("Attempt " + String(attempt) + "/" + String(maxRetries));
    
    httpCode = http.PATCH(payload);
    
    if (httpCode == 200) {
      String response = http.getString();
      Serial.println("Response Code: " + String(httpCode));
      Serial.println("SUCCESS! Data uploaded to Firestore");
      Serial.println("Card UID: " + cardID);
      Serial.println("Custom UID: " + customUID);
      Serial.println("Tap Count: " + String(tapCount) + "/" + String(MAX_TAPS));
      
      digitalWrite(LED_PIN, HIGH);
      delay(1000);
      digitalWrite(LED_PIN, LOW);
      
      http.end();
      Serial.println("=== FIRESTORE UPLOAD COMPLETE ===\n");
      return;
    } else {
      Serial.println("Failed on attempt " + String(attempt));
      Serial.println("Error code: " + String(httpCode));
      
      if (attempt < maxRetries) {
        Serial.println("Retrying in 3 seconds...");
        delay(3000);
      }
    }
  }
  
  Serial.println("FAILED after all retries! Error code: " + String(httpCode));
  addFailedUpload(cardID, customUID, tapCount);
  beep(5);
  
  http.end();
  Serial.println("=== FIRESTORE UPLOAD COMPLETE ===\n");
}

void addFailedUpload(String cardUID, String customUID, int tapCount) {
  if (failedUploads.size() >= MAX_FAILED_UPLOADS) {
    failedUploads.erase(failedUploads.begin());
  }
  
  FailedUpload failed;
  failed.cardUID = cardUID;
  failed.customUID = customUID;
  failed.tapCount = tapCount;
  failed.timestamp = getDateTime();
  failed.attemptTime = millis();
  
  failedUploads.push_back(failed);
  Serial.println("Added failed upload to retry queue for card: " + cardUID);
}

void retryFailedUploads() {
  if (failedUploads.empty()) {
    return;
  }
  
  Serial.println("Retrying " + String(failedUploads.size()) + " failed uploads...");
  
  for (auto it = failedUploads.begin(); it != failedUploads.end();) {
    if (millis() - it->attemptTime > 3600000) {
      Serial.println("Removing old failed upload for card: " + it->cardUID);
      it = failedUploads.erase(it);
      continue;
    }
    
    Serial.println("Retrying upload for card: " + it->cardUID);
    sendToFirestore(it->cardUID, it->customUID, it->tapCount);
    
    if (WiFi.status() == WL_CONNECTED) {
      it = failedUploads.erase(it);
    } else {
      ++it;
    }
    
    delay(1000);
  }
}

String getNextDocName() {
  String doc = "RFID" + String(docCounter);
  while (doc.length() < 10) {
    doc = "RFID0" + doc.substring(4);
  }
  docCounter++;
  return doc;
}

String getDateTime() {
  struct tm timeinfo;
  if (timeInitialized && getLocalTime(&timeinfo)) {
    char buffer[25];
    strftime(buffer, sizeof(buffer), "%Y-%m-%d %H:%M:%S", &timeinfo);
    return String(buffer);
  }
  
  unsigned long ms = millis();
  unsigned long seconds = ms / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  
  seconds %= 60;
  minutes %= 60;
  hours %= 24;
  
  char fallbackTime[32];
  sprintf(fallbackTime, "2025-10-06 %02lu:%02lu:%02lu", hours, minutes, seconds);
  return String(fallbackTime);
}

void beep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}