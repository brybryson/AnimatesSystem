#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <map>
#include <Preferences.h>
#include <esp_task_wdt.h>

Preferences preferences;
std::map<String, int> cardTapCount;
std::map<String, String> cardCustomUID;

// WiFi credentials array for fallback connections
struct WiFiCredentials {
  const char* ssid;
  const char* password;
};

WiFiCredentials wifiList[] = {
  {"Shiva", "ayawkonga"},
  {"PLDTHOMEFIBRc11f8", "PLDTWIFIg9y9y"}
  // Add more WiFi credentials as needed
};
const int numWiFiNetworks = sizeof(wifiList) / sizeof(wifiList[0]);
//192.168.1.58
#define SERVER_URL "http://192.168.1.58/animates/api/rfid_endpoint.php" 
// #define SERVER_URL "https://animates.infinityfree.me/animates/api/rfid_endpoint.php" 


// Pin definitions for ESP32
#define SS_PIN    21    // SDA/SS pin for RFID
#define RST_PIN   22    // Reset pin for RFID
#define BUZZER_PIN 17   // Buzzer pin
#define STATUS_LED_PIN 2  // Built-in LED for status indication

// Create MFRC522 instance
MFRC522 mfrc522(SS_PIN, RST_PIN);

// Time configuration
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 28800; // GMT+8 for Philippines (8 * 3600)
const int daylightOffset_sec = 0;
bool timeInitialized = false;

// Variables for better detection
String lastCardID = "";
unsigned long lastDetectionTime = 0;
unsigned long cardTimeout = 2000; // Consider card "gone" after 2 seconds of no detection
bool cardWasPresent = false;

// Variables for 3-second validation and 5-second disable
unsigned long sameCardStartTime = 0;
bool sameCardDetected = false;
bool validationSuccessful = false;
unsigned long disableStartTime = 0;
bool rfidDisabled = false;
const unsigned long VALIDATION_TIME = 3000; // 3 seconds
const unsigned long DISABLE_TIME = 5000; // 5 seconds

// Card detection debouncing
unsigned long lastCardDetection = 0;
const unsigned long DEBOUNCE_TIME = 500; // 500ms debounce

// WiFi health monitoring
unsigned long lastWiFiCheck = 0;
int consecutiveWiFiFailures = 0;

// Configuration structure - UPDATED to 3 max taps
struct DeviceConfig {
    int maxTaps;
    unsigned long validationTime;
    unsigned long disableTime;
    unsigned long cardTimeout;
    String serverUrl;
};

DeviceConfig config = {
    .maxTaps = 3, // CHANGED from 5 to 3
    .validationTime = 3000,
    .disableTime = 5000,
    .cardTimeout = 2000,
    .serverUrl = "http://192.168.1.58/animates/api/rfid_endpoint.php" 
};

// Add queue for failed uploads
struct FailedUpload {
    String cardUID;
    String customUID;
    int tapCount;
    unsigned long timestamp;
};

std::vector<FailedUpload> failedUploads;
const int MAX_FAILED_UPLOADS = 10; // Maximum failed uploads to store

// Function to debug WiFi status
void debugWiFiStatus() {
  Serial.println("========== WiFi Debug Info ==========");
  Serial.println("WiFi Status: " + String(WiFi.status()));
  Serial.println("WiFi Mode: " + String(WiFi.getMode()));
  Serial.println("MAC Address: " + WiFi.macAddress());
  
  // Scan for available networks
  Serial.println("Scanning for networks...");
  int n = WiFi.scanNetworks();
  if (n > 0) {
    for (int i = 0; i < n; i++) {
      Serial.printf("%d: %s (%d dBm) %s\n", 
                    i + 1, 
                    WiFi.SSID(i).c_str(), 
                    WiFi.RSSI(i),
                    (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Encrypted");
      
      // Check if this is our PLDT network
      if (String(WiFi.SSID(i)) == "PLDTHOMEFIBRc11f8") {
        Serial.println("   *** FOUND YOUR PLDT NETWORK! ***");
      }
    }
  } else {
    Serial.println("No networks found");
  }
  WiFi.scanDelete();
  Serial.println("====================================");
}

// Function to generate Custom UID based on RFID UID (consistent for same card)
String generateCustomUIDFromRFID(String rfidUID) {
  // Remove colons and convert to uppercase
  String cleanUID = rfidUID;
  cleanUID.replace(":", "");
  cleanUID.toUpperCase();
  
  // Use the RFID UID as seed for consistent generation
  unsigned long seed = 0;
  for (int i = 0; i < cleanUID.length(); i++) {
    seed += cleanUID.charAt(i) * (i + 1);
  }
  
  const char alphaNum[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const int alphaNumLength = sizeof(alphaNum) - 1;
  String customUID = "";
  
  // Use seed for consistent random generation
  randomSeed(seed);
  
  // Generate 8 characters
  for (int i = 0; i < 8; i++) {
    int randomIndex = random(0, alphaNumLength);
    customUID += alphaNum[randomIndex];
  }
  
  return customUID;
}

// Function to clear all stored card data - ADDED
void clearAllStoredData() {
  Serial.println("========================================");
  Serial.println("🗑️ CLEARING ALL STORED CARD DATA");
  Serial.println("========================================");
  
  // Clear in-memory maps
  cardTapCount.clear();
  cardCustomUID.clear();
  
  // Clear all preferences
  preferences.clear();
  
  Serial.println("✅ All stored card data has been cleared!");
  Serial.println("🔄 Device reset to factory state");
  Serial.println("========================================");
  
  // Success indication
  for(int i = 0; i < 5; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(100);
  }
}

// Fixed WiFi connection function
void connectToWiFi() {
  Serial.println("🌐 Initializing WiFi connection...");
  
  // Complete WiFi reset
  WiFi.mode(WIFI_OFF);
  delay(2000);
  
  // Clear all WiFi config
  WiFi.persistent(false);
  WiFi.disconnect(true);
  WiFi.mode(WIFI_STA);
  delay(2000);
  
  // Scan for networks first
  debugWiFiStatus();
  
  for (int i = 0; i < numWiFiNetworks; i++) {
    Serial.printf("📡 Attempting connection to: %s\n", wifiList[i].ssid);
    Serial.printf("🔑 Using password: %s\n", wifiList[i].password);
    
    // Ensure WiFi is ready
    WiFi.mode(WIFI_STA);
    delay(1000);
    
    // Clear any previous connection state
    WiFi.disconnect();
    delay(1000);
    
    // Start connection with explicit parameters
    WiFi.begin(wifiList[i].ssid, wifiList[i].password);
    Serial.println("🔄 Connection initiated...");
    
    // Extended wait with detailed status monitoring
    int attempts = 0;
    unsigned long startTime = millis();
    
    while (WiFi.status() != WL_CONNECTED && attempts < 40) { // 20 seconds timeout
      delay(500);
      Serial.print(".");
      attempts++;
      
      // Print detailed status every 5 seconds
      if (attempts % 10 == 0) {
        Serial.println();
        Serial.printf("🔍 Status after %d seconds: %d\n", attempts/2, WiFi.status());
        Serial.printf("📊 WiFi Status Codes:\n");
        Serial.printf("   WL_IDLE_STATUS = 0\n");
        Serial.printf("   WL_NO_SSID_AVAIL = 1\n");
        Serial.printf("   WL_SCAN_COMPLETED = 2\n");
        Serial.printf("   WL_CONNECTED = 3\n");
        Serial.printf("   WL_CONNECT_FAILED = 4\n");
        Serial.printf("   WL_CONNECTION_LOST = 5\n");
        Serial.printf("   WL_DISCONNECTED = 6\n");
        Serial.printf("🎯 Current Status: %d\n", WiFi.status());
        Serial.print("🔄 Continuing");
      }
      
      // Check for immediate failures
      if (WiFi.status() == WL_NO_SSID_AVAIL) {
        Serial.println("\n❌ SSID not found!");
        break;
      }
      if (WiFi.status() == WL_CONNECT_FAILED) {
        Serial.println("\n❌ Authentication failed!");
        break;
      }
    }
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println();
      Serial.println("🎉 *** CONNECTION SUCCESSFUL! ***");
      Serial.printf("✅ Connected to: %s\n", wifiList[i].ssid);
      Serial.printf("🌐 IP Address: %s\n", WiFi.localIP().toString().c_str());
      Serial.printf("🌐 Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
      Serial.printf("🌐 Subnet: %s\n", WiFi.subnetMask().toString().c_str());
      Serial.printf("🌐 DNS: %s\n", WiFi.dnsIP().toString().c_str());
      Serial.printf("📶 Signal Strength: %d dBm\n", WiFi.RSSI());
      Serial.printf("📱 MAC Address: %s\n", WiFi.macAddress().c_str());
      
      // Test internet connectivity
      Serial.println("🌍 Testing internet connectivity...");
      HTTPClient http;
      http.begin("http://google.com");
      http.setTimeout(5000);
      int httpCode = http.GET();
      http.end();
      
      if (httpCode > 0) {
        Serial.println("✅ Internet access confirmed!");
      } else {
        Serial.println("⚠️ No internet access detected");
      }
      
      consecutiveWiFiFailures = 0;
      return; // Exit function on successful connection
    } else {
      Serial.println();
      Serial.printf("❌ Failed to connect to: %s\n", wifiList[i].ssid);
      Serial.printf("💥 Final Status Code: %d\n", WiFi.status());
      
      // Analyze the failure
      switch(WiFi.status()) {
        case WL_NO_SSID_AVAIL:
          Serial.println("🔍 Issue: Network name not found. Check SSID spelling.");
          break;
        case WL_CONNECT_FAILED:
          Serial.println("🔑 Issue: Wrong password or network security mismatch.");
          break;
        case WL_IDLE_STATUS:
          Serial.println("⏳ Issue: Connection timeout. Network may be too far.");
          break;
        default:
          Serial.println("❓ Issue: Unknown connection problem.");
          break;
      }
      
      // Complete reset before trying next network
      WiFi.disconnect(true);
      delay(3000);
    }
  }
  
  // If we reach here, no WiFi networks worked
  Serial.println("💥 ERROR: Could not connect to any WiFi network!");
  Serial.println("🔧 Troubleshooting suggestions:");
  Serial.println("   1. Verify SSID names are correct (case-sensitive)");
  Serial.println("   2. Verify passwords are correct");
  Serial.println("   3. Check if networks are in range");
  Serial.println("   4. Ensure networks are broadcasting (not hidden)");
  Serial.println("   5. Check router settings for MAC filtering");
  
  consecutiveWiFiFailures++;
  
  if (consecutiveWiFiFailures >= 3) {
    Serial.println("🔄 Too many failures. Restarting ESP32 in 10 seconds...");
    delay(10000);
    ESP.restart(); // Restart the ESP32 to clear any WiFi state issues
  } else {
    Serial.println("🔄 Retrying all networks in 15 seconds...");
    delay(15000);
    connectToWiFi(); // Retry immediately
  }
}

// Improved WiFi health monitoring
void checkWiFiHealth() {
  if (millis() - lastWiFiCheck > 30000) { // Check every 30 seconds
    lastWiFiCheck = millis();
    
    if (WiFi.status() != WL_CONNECTED) {
      consecutiveWiFiFailures++;
      Serial.println("📶 WiFi disconnected. Attempt " + String(consecutiveWiFiFailures));
      Serial.println("📊 WiFi Status Code: " + String(WiFi.status()));
      
      if (consecutiveWiFiFailures >= 3) {
        Serial.println("🔄 Reconnecting to WiFi...");
        // Proper WiFi reset before reconnection
        WiFi.disconnect(true, true);
        delay(3000);
        connectToWiFi();
        consecutiveWiFiFailures = 0;
      }
    } else {
      consecutiveWiFiFailures = 0;
      // Log WiFi stats periodically
      Serial.println("📶 WiFi: " + WiFi.SSID() + " | Signal: " + String(WiFi.RSSI()) + " dBm | IP: " + WiFi.localIP().toString());
    }
  }
}

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  delay(2000);  // Give Serial Monitor time to connect
  
  Serial.println();
  Serial.println("========================================");
  Serial.println("🚀 ESP32 RFID SCANNER STARTING UP");
  Serial.println("📊 NEW CONFIGURATION: 3 TAPS MAXIMUM");
  Serial.println("========================================");
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  
  // Enable watchdog timer
  esp_task_wdt_config_t twdt_config = {
    .timeout_ms = 60000, // 60 second timeout (increased)
    .idle_core_mask = (1 << 0), // Bitmask for core 0
    .trigger_panic = true
  };
  esp_task_wdt_deinit(); // Ensure no watchdog is already configured
  esp_task_wdt_init(&twdt_config);
  esp_task_wdt_add(NULL);
  
  // Initialize preferences and clear all stored data - ADDED
  preferences.begin("rfid_data", false);
  clearAllStoredData(); // Clear all previous data on startup
  
  // Try to connect to WiFi networks
  connectToWiFi();
  
  // Quick time setup
  quickTimeSetup();
  
  Serial.println("🔧 Initializing RFID scanner...");
  
  // Initialize SPI bus
  SPI.begin();
  
  // Initialize MFRC522
  mfrc522.PCD_Init();
  
  // Check RFID scanner status
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if ((version == 0x00) || (version == 0xFF)) {
    Serial.println("⚠️ WARNING: RFID Scanner communication failed!");
    indicateStatus("error");
  } else {
    Serial.println("✅ RFID Scanner connected successfully!");
    indicateStatus("success");
  }
  
  // Show details of PCD - MFRC522 Card Reader
  mfrc522.PCD_DumpVersionToSerial();
  
  // Load configuration (updated values)
  loadConfig();
  
  Serial.println("========================================");
  Serial.println("🎯 RFID READER READY!");
  Serial.println("📱 Tap an RFID card/tag to read its ID");
  Serial.println("⏱️ Hold card for 3 seconds for validation");
  Serial.println("🔢 Maximum 3 taps per service cycle");
  Serial.println("========================================");
}

// Quick time setup - No hanging!
void quickTimeSetup() {
  Serial.println("⏰ Configuring time with NTP server (5 second max)...");
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
    Serial.println("✅ Time synchronized successfully!");
    char timeString[64];
    strftime(timeString, sizeof(timeString), "%Y-%m-%d %H:%M:%S", &timeinfo);
    Serial.println("📅 Current time: " + String(timeString));
    timeInitialized = true;
  } else {
    Serial.println();
    Serial.println("⚠️ NTP sync timeout - using system timestamps");
    Serial.println("✅ Ready to continue with fallback timing");
    timeInitialized = false;
  }
}

void loop() {
  // Reset watchdog timer
  esp_task_wdt_reset();
  
  // Check WiFi health
  checkWiFiHealth();
  
  // Retry failed uploads periodically (every 30 seconds)
  static unsigned long lastRetryTime = 0;
  if (millis() - lastRetryTime > 30000) {
    lastRetryTime = millis();
    retryFailedUploads();
  }
  
  // Check if RFID is disabled (5-second timeout after successful validation)
  if (rfidDisabled) {
    if (millis() - disableStartTime >= DISABLE_TIME) {
      // Re-enable RFID after 5 seconds
      rfidDisabled = false;
      validationSuccessful = false;
      sameCardDetected = false;
      lastCardID = "";
      Serial.println("🔄 RFID Reader Re-enabled!");
      Serial.println("🎯 Ready for next card...");
      Serial.println("----------------------------------------");
      indicateStatus("scanning");
    } else {
      // Show countdown
      unsigned long timeLeft = (DISABLE_TIME - (millis() - disableStartTime)) / 1000 + 1;
      Serial.println("⏸️ RFID DISABLED - Reactivating in " + String(timeLeft) + " seconds...");
      delay(1000);
      return;
    }
  }

  bool cardDetected = false;
  String currentCardID = "";
  
  // Try to detect card with debouncing
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    unsigned long currentTime = millis();
    
    // Debounce card detection
    if (currentTime - lastCardDetection < DEBOUNCE_TIME) {
      delay(100);
      return;
    }
    
    lastCardDetection = currentTime;
    cardDetected = true;
    lastDetectionTime = millis();
    
    // Build card ID string
    for (byte i = 0; i < mfrc522.uid.size; i++) {
      if (mfrc522.uid.uidByte[i] < 0x10) {
        currentCardID += "0";
      }
      currentCardID += String(mfrc522.uid.uidByte[i], HEX);
      if (i < mfrc522.uid.size - 1) {
        currentCardID += ":";
      }
    }
    
    // Check if same card as before
    if (currentCardID == lastCardID) {
      if (!sameCardDetected) {
        // First time detecting this specific card
        sameCardStartTime = millis();
        sameCardDetected = true;
        Serial.println("🆕 New card detected - Starting 3-second validation...");
        
        // Single beep for new card
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100);
        digitalWrite(BUZZER_PIN, LOW);
        indicateStatus("scanning");
      }
      
      // Same card continues - check if 3 seconds have passed
      if (millis() - sameCardStartTime >= VALIDATION_TIME && !validationSuccessful) {
        // SUCCESS! 3 seconds completed
        Serial.println("🎉 *** SUCCESS! CARD VALIDATED! ***");
        Serial.println("✅ Card UID: " + currentCardID + " - APPROVED");
        Serial.println("🏁 Validation completed successfully!");
        Serial.println("----------------------------------------");
        
        // Send data to mysql immediately after successful validation
        sendToMySQL(currentCardID);
        
        // Buzzer success pattern (3 short beeps)
        for(int i = 0; i < 3; i++) {
          digitalWrite(BUZZER_PIN, HIGH);
          delay(200);
          digitalWrite(BUZZER_PIN, LOW);
          delay(200);
        }
        
        indicateStatus("success");
        validationSuccessful = true;
        rfidDisabled = true;
        disableStartTime = millis();
        return;
      }
    } else {
      // Different card detected - reset everything
      sameCardStartTime = millis();
      sameCardDetected = true;
      Serial.println("🔄 Different card detected - Starting 3-second validation...");
      
      // Single beep for new card
      digitalWrite(BUZZER_PIN, HIGH);
      delay(100);
      digitalWrite(BUZZER_PIN, LOW);
      indicateStatus("scanning");
    }
    
    // Show detection with countdown
    unsigned long timeHeld = millis() - sameCardStartTime;
    unsigned long timeLeft = (VALIDATION_TIME - timeHeld) / 1000 + 1;
    
    Serial.print("🔍 SCANNING - Card UID: ");
    Serial.println(currentCardID);
    Serial.println("🏷️ Card ID (String): " + currentCardID);
    if (timeLeft > 0 && !validationSuccessful) {
      Serial.println("⏳ Status: Hold for " + String(timeLeft) + " more seconds for validation");
    } else {
      Serial.println("🟢 Status: Card Present & Active");
    }
    Serial.println("----------------------------------------");
    
    lastCardID = currentCardID;
    cardWasPresent = true;
  }
  
  // Check if card has been gone for too long
  if (cardWasPresent && (millis() - lastDetectionTime > cardTimeout)) {
    Serial.println("📤 Card removed - Validation cancelled");
    Serial.println("⏳ Waiting for RFID card...");
    Serial.println("----------------------------------------");
    cardWasPresent = false;
    sameCardDetected = false;
    lastCardID = "";
    sameCardStartTime = 0;
    indicateStatus("scanning");
  }
  
  // Shorter delay for more responsive detection
  delay(200);
}

// Status LED indication
void indicateStatus(const char* status) {
  if (strcmp(status, "scanning") == 0) {
    // Blink slowly
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(500);
    digitalWrite(STATUS_LED_PIN, LOW);
  } else if (strcmp(status, "success") == 0) {
    // Solid on
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(2000);
    digitalWrite(STATUS_LED_PIN, LOW);
  } else if (strcmp(status, "error") == 0) {
    // Fast blink
    for (int i = 0; i < 5; i++) {
      digitalWrite(STATUS_LED_PIN, HIGH);
      delay(100);
      digitalWrite(STATUS_LED_PIN, LOW);
      delay(100);
    }
  }
}

// Updated time functions - MySQL Compatible Format
String getFastDateTime() {
  // Try to get real time quickly
  struct tm timeinfo;
  if (timeInitialized && getLocalTime(&timeinfo)) {
    char dateTime[64];
    // Use MySQL format: YYYY-MM-DD HH:MM:SS
    strftime(dateTime, sizeof(dateTime), "%Y-%m-%d %H:%M:%S", &timeinfo);
    return String(dateTime);
  }
  
  // Fallback to system uptime with proper format
  unsigned long ms = millis();
  unsigned long seconds = ms / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  
  seconds %= 60;
  minutes %= 60;
  hours %= 24;
  
  // Generate a fake but valid MySQL timestamp
  char sysTime[32];
  sprintf(sysTime, "2025-08-17 %02lu:%02lu:%02lu", hours, minutes, seconds);
  return String(sysTime);
}

String getFastTimestamp() {
  // Return MySQL compatible timestamp format
  struct tm timeinfo;
  if (timeInitialized && getLocalTime(&timeinfo)) {
    char timestamp[32];
    // Use MySQL format instead of ISO 8601
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%d %H:%M:%S", &timeinfo);
    return String(timestamp);
  }
  
  // Fallback timestamp in MySQL format
  unsigned long ms = millis();
  unsigned long seconds = ms / 1000;
  unsigned long minutes = seconds / 60;
  unsigned long hours = minutes / 60;
  
  seconds %= 60;
  minutes %= 60;
  hours %= 24;
  
  char fallbackTime[32];
  sprintf(fallbackTime, "2025-08-17 %02lu:%02lu:%02lu", hours, minutes, seconds);
  return String(fallbackTime);
}

// Function to check RFID scanner status
String getRFIDStatus() {
  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  if ((version == 0x00) || (version == 0xFF)) {
    return "ERROR";
  } else {
    return "OK";
  }
}

// Load configuration from preferences - UPDATED for 3 taps
void loadConfig() {
  config.maxTaps = preferences.getInt("maxTaps", 3); // CHANGED default from 5 to 3
  config.validationTime = preferences.getULong("validationTime", 3000);
  config.disableTime = preferences.getULong("disableTime", 5000);
  config.cardTimeout = preferences.getULong("cardTimeout", 2000);
  config.serverUrl = preferences.getString("serverUrl", "http://192.168.1.58/animates/api/rfid_endpoint.php" );
  
  Serial.println("⚙️ Configuration loaded:");
  Serial.println("   Max Taps: " + String(config.maxTaps));
  Serial.println("   Validation Time: " + String(config.validationTime) + "ms");
  Serial.println("   Disable Time: " + String(config.disableTime) + "ms");
  Serial.println("   Card Timeout: " + String(config.cardTimeout) + "ms");
}

void loadCardData() {
  // REMOVED: No loading of previous data since we clear on startup
  Serial.println("📂 Card data cleared on startup - starting fresh");
}

void saveCardData() {
  // Save all card UIDs as a comma-separated string
  String allKeys = "";
  
  for (auto& pair : cardTapCount) {
    allKeys += pair.first + ",";
    
    // Save individual tap count and custom UID
    preferences.putInt(("tap_" + pair.first).c_str(), pair.second);
    preferences.putString(("uid_" + pair.first).c_str(), cardCustomUID[pair.first]);
  }
  
  preferences.putBytes("cardKeys", allKeys.c_str(), allKeys.length());
  Serial.println("💾 Card data saved to preferences");
}

// Improved card reuse logic with upload retry - UPDATED for 3 taps
String getOrCreateCustomUID(String cardUID) {
    // Check if card exists in our tracking
    if (cardTapCount.find(cardUID) == cardTapCount.end()) {
        // New card - create first entry
        cardTapCount[cardUID] = 0;
        cardCustomUID[cardUID] = generateCustomUIDFromRFID(cardUID);
        Serial.println("🆕 New card registered: " + cardUID + " -> " + cardCustomUID[cardUID]);
    }
    
    // Don't increment tap count here - wait for successful upload
    int currentTapCount = cardTapCount[cardUID];
    
    Serial.println("📊 Card: " + cardUID + " - Current Tap #" + String(currentTapCount) + "/" + String(config.maxTaps));
    
    // Check if we need to reset for reuse (after max taps) - UPDATED for 3 taps
    if (currentTapCount >= config.maxTaps) {
        // Reset to 0 for new cycle
        cardTapCount[cardUID] = 0;
        // Generate new customUID with consistent seed
        String newSeed = cardUID + "_cycle_" + String(millis() / 60000); // Use minute-based seed
        cardCustomUID[cardUID] = generateCustomUIDFromRFID(newSeed);
        Serial.println("🔄 Card completed 3-tap cycle! New CustomUID generated: " + cardCustomUID[cardUID]);
        Serial.println("🎫 Card ready for new customer assignment");
        currentTapCount = 0; // Reset current count
    }
    
    return cardCustomUID[cardUID];
}

// Function to increment tap count after successful upload
void incrementTapCount(String cardUID) {
    cardTapCount[cardUID]++;
    Serial.println("✅ Tap count incremented to: " + String(cardTapCount[cardUID]));
    saveCardData(); // Save to persistent storage
}

// Function to retry failed uploads
void retryFailedUploads() {
    if (failedUploads.empty()) {
        return;
    }
    
    Serial.println("🔄 Retrying " + String(failedUploads.size()) + " failed uploads...");
    
    for (auto it = failedUploads.begin(); it != failedUploads.end();) {
        // Check if upload is too old (older than 1 hour)
        if (millis() - it->timestamp > 3600000) { // 1 hour = 3600000ms
            Serial.println("⏰ Removing old failed upload for card: " + it->cardUID);
            it = failedUploads.erase(it);
            continue;
        }
        
        // Try to upload again
        if (sendToMySQLWithRetry(it->cardUID, it->customUID, it->tapCount)) {
            Serial.println("✅ Successfully retried upload for card: " + it->cardUID);
            it = failedUploads.erase(it);
        } else {
            Serial.println("❌ Retry failed for card: " + it->cardUID);
            ++it;
        }
        
        delay(1000); // Wait between retries
    }
}

// Add failed upload to queue
void addFailedUpload(String cardUID, String customUID, int tapCount) {
    if (failedUploads.size() >= MAX_FAILED_UPLOADS) {
        // Remove oldest failed upload
        failedUploads.erase(failedUploads.begin());
    }
    
    FailedUpload failed;
    failed.cardUID = cardUID;
    failed.customUID = customUID;
    failed.tapCount = tapCount;
    failed.timestamp = millis();
    
    failedUploads.push_back(failed);
    Serial.println("📝 Added failed upload to retry queue for card: " + cardUID);
}

// Data validation function
bool validateCardData(String cardUID, String customUID, int tapCount) {
  if (cardUID.length() == 0 || cardUID.length() > 50) {
    Serial.println("❌ Invalid card UID length");
    return false;
  }
  
  if (customUID.length() != 8) {
    Serial.println("❌ Invalid custom UID length");
    return false;
  }
  
  if (tapCount < 1 || tapCount > 3) { // UPDATED: changed from 10 to 3
    Serial.println("❌ Invalid tap count");
    return false;
  }
  
  return true;
}

// Improved HTTP request handling with retry mechanism
bool sendToMySQLWithRetry(String cardUID, String customUID, int tapCount) {
    Serial.println("========================================");
    Serial.println("🔄 PREPARING TO SEND DATA TO DATABASE");
    Serial.println("========================================");
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("❌ No WiFi connection. Cannot send data.");
        Serial.println("📶 Current WiFi Status: " + String(WiFi.status()));
        indicateStatus("error");
        return false;
    }
    
    Serial.println("📝 Processing card data...");
    
    if (!validateCardData(cardUID, customUID, tapCount)) {
        Serial.println("❌ Data validation failed. Not sending to server.");
        indicateStatus("error");
        return false;
    }
    
    // Use FAST time functions (no hanging!)
    String currentDateTime = getFastDateTime();
    String currentTimestamp = getFastTimestamp();
    String rfidStatus = getRFIDStatus();
    
    Serial.println("🕒 Time: " + currentDateTime);
    Serial.println("🆔 Custom UID: " + customUID);
    Serial.println("🔢 Tap count: " + String(tapCount));
    
    // Create JSON with larger buffer
    DynamicJsonDocument doc(2048);
    doc["card_uid"] = cardUID;
    doc["custom_uid"] = customUID;
    doc["tap_count"] = tapCount;
    doc["max_taps"] = config.maxTaps;
    doc["tap_number"] = tapCount;
    doc["device_info"] = "ESP32-RFID-Scanner";
    doc["wifi_network"] = WiFi.SSID();
    doc["signal_strength"] = WiFi.RSSI();
    doc["validation_status"] = "approved";
    doc["readable_time"] = currentDateTime;
    doc["timestamp_value"] = currentTimestamp;
    doc["rfid_scanner_status"] = rfidStatus;
    doc["validation_time_ms"] = VALIDATION_TIME;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    Serial.println("📄 JSON Data: " + jsonString);
    Serial.println("🌐 Sending to: " + String(config.serverUrl));
    
    // Send HTTP POST with timeout and retry
    HTTPClient http;
    http.begin(config.serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(15000); // 15 second timeout
    
    Serial.println("📡 Sending HTTP request...");
    
    // Retry mechanism
    int maxRetries = 3;
    int httpResponseCode = 0;
    
    for (int attempt = 1; attempt <= maxRetries; attempt++) {
        Serial.println("🔄 Attempt " + String(attempt) + "/" + String(maxRetries));
        
        httpResponseCode = http.POST(jsonString);
        
        if (httpResponseCode > 0) {
            String response = http.getString();
            Serial.println("📥 Server Response Code: " + String(httpResponseCode));
            
            if (httpResponseCode == 200) {
                Serial.println("🎉 SUCCESS! Data sent to MySQL database");
                Serial.println("🏷️ Card UID: " + cardUID);
                Serial.println("🆔 Custom UID: " + customUID);
                Serial.println("📊 Tap Count: " + String(tapCount) + "/" + String(config.maxTaps));
                
                // Parse response for additional info
                DynamicJsonDocument responseDoc(1024);
                deserializeJson(responseDoc, response);
                
                if (responseDoc.containsKey("success")) {
                    Serial.println("✅ Server confirmed success: " + String(responseDoc["success"].as<bool>()));
                    
                    // Display full response details
                    if (responseDoc.containsKey("card_id")) {
                        Serial.println("📇 Card ID: " + String(responseDoc["card_id"].as<int>()));
                    }
                    if (responseDoc.containsKey("custom_uid")) {
                        Serial.println("🆔 Custom UID: " + String(responseDoc["custom_uid"].as<const char*>()));
                    }
                    if (responseDoc.containsKey("tap_count")) {
                        Serial.println("🔢 Tap Count: " + String(responseDoc["tap_count"].as<int>()));
                    }
                    if (responseDoc.containsKey("booking_updated")) {
                        Serial.println("📝 Booking Updated: " + String(responseDoc["booking_updated"].as<bool>() ? "Yes" : "No"));
                    }
                    if (responseDoc.containsKey("booking_id")) {
                        if (!responseDoc["booking_id"].isNull()) {
                            Serial.println("🔖 Booking ID: " + String(responseDoc["booking_id"].as<int>()));
                        } else {
                            Serial.println("🔖 Booking ID: None");
                        }
                    }
                    if (responseDoc.containsKey("status_changed_to")) {
                        if (!responseDoc["status_changed_to"].isNull()) {
                            Serial.println("🔄 Status Changed To: " + String(responseDoc["status_changed_to"].as<const char*>()));
                        } else {
                            Serial.println("🔄 Status Changed To: None");
                        }
                    }
                    if (responseDoc.containsKey("is_completion")) {
                        Serial.println("🏁 Is Completion: " + String(responseDoc["is_completion"].as<bool>() ? "Yes" : "No"));
                    }
                    if (responseDoc.containsKey("email_sent")) {
                        Serial.println("📧 Email Sent: " + String(responseDoc["email_sent"].as<bool>() ? "Yes" : "No"));
                    }
                    if (responseDoc.containsKey("message")) {
                        Serial.println("💬 Message: " + String(responseDoc["message"].as<const char*>()));
                    }
                }
                
                indicateStatus("success");
                http.end();
                Serial.println("🔚 HTTP connection closed");
                Serial.println("========================================");
                return true; // Success!
            } else {
                Serial.println("⚠️ Server responded with non-200 code: " + String(httpResponseCode));
                Serial.println("📝 Response: " + response);
                if (attempt < maxRetries) {
                    Serial.println("🔄 Retrying in 3 seconds... (Attempt " + String(attempt + 1) + "/" + String(maxRetries) + ")");
                    delay(3000);
                }
            }
        } else {
            Serial.println("❌ Failed to send to database (Attempt " + String(attempt) + "/" + String(maxRetries) + ")");
            Serial.println("💥 Error Code: " + String(httpResponseCode));
            Serial.println("📶 WiFi Status: " + String(WiFi.status()));
            Serial.println("🌐 Connected to: " + WiFi.SSID());
            Serial.println("📶 Signal: " + String(WiFi.RSSI()) + " dBm");
            
            if (attempt < maxRetries) {
                Serial.println("🔄 Retrying in 5 seconds...");
                delay(5000);
            } else {
                Serial.println("🔍 Final failure. Possible issues:");
                Serial.println("   • Server not running");
                Serial.println("   • Wrong URL: " + config.serverUrl);
                Serial.println("   • Network connectivity issues");
                Serial.println("   • Firewall blocking requests");
                indicateStatus("error");
            }
        }
    }
    
    http.end();
    Serial.println("🔚 HTTP connection closed");
    Serial.println("========================================");
    return false; // Failed after all retries
}

// Updated sendToMySQL function that handles tap count properly
void sendToMySQL(String cardUID) {
    // Get custom UID (without incrementing tap count)
    String customUID = getOrCreateCustomUID(cardUID);
    int currentTapCount = cardTapCount[cardUID];
    int newTapCount = currentTapCount + 1; // Calculate what the new count would be
    
    // Try to send data with the new tap count
    if (sendToMySQLWithRetry(cardUID, customUID, newTapCount)) {
        // Success! Now increment the tap count
        incrementTapCount(cardUID);
    } else {
        // Failed! Add to retry queue
        addFailedUpload(cardUID, customUID, newTapCount);
        Serial.println("⚠️ Upload failed - added to retry queue");
    }
}

// Error recovery function
void handleError(const char* error) {
  Serial.println("💥 ERROR: " + String(error));
  
  // Try to recover
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("🔄 Attempting WiFi recovery...");
    connectToWiFi();
  }
  
  // Reset RFID scanner if needed
  if (getRFIDStatus() == "ERROR") {
    Serial.println("🔄 Resetting RFID scanner...");
    mfrc522.PCD_Reset();
    delay(1000);
    mfrc522.PCD_Init();
  }
}