/*
 * ESP32 RFID Scanner with Firebase Integration
 * Sends RFID data to Firebase Realtime Database instead of direct API calls
 *
 * This solves hosting provider blocking issues by using Firebase as intermediary
 */

#include <WiFi.h>
#include <SPI.h>
#include <MFRC522.h>
#include <FirebaseESP32.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase Configuration
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// RFID Configuration
#define SS_PIN  5   // ESP32 pin GPIO5
#define RST_PIN 27  // ESP32 pin GPIO27
MFRC522 rfid(SS_PIN, RST_PIN);

// RFID Variables
String currentRFID = "";
int tapCount = 0;
unsigned long lastTapTime = 0;
const unsigned long DEBOUNCE_DELAY = 2000; // 2 seconds between taps

// LED and Buzzer pins
#define LED_PIN 2
#define BUZZER_PIN 4

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 RFID Scanner with Firebase Integration");
  Serial.println("==========================================");

  // Initialize LED and Buzzer
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Connect to WiFi
  connectToWiFi();

  // Firebase configuration
  config.api_key = "AIzaSyBCqI4oN_ikpKRxeRSaCaopCnCCmBImZqA";
  config.database_url = "https://animatesrfid-default-rtdb.firebaseio.com/";

  // Initialize Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Test Firebase connection
  if (Firebase.ready()) {
    Serial.println("✅ Firebase initialized successfully");
  } else {
    Serial.println("❌ Firebase initialization failed");
  }

  // Initialize RFID
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("✅ RFID scanner initialized");
  Serial.println("🔄 Ready to scan RFID cards...");
}

void loop() {
  // Check if a new card is present
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  // Check if the card can be read
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Check debounce delay
  if (millis() - lastTapTime < DEBOUNCE_DELAY) {
    Serial.println("⏳ Debounce: Ignoring rapid tap");
    return;
  }

  // Read RFID tag
  String rfidTag = getRFIDTag();
  if (rfidTag == "") {
    return;
  }

  // Process the RFID tap
  processRFIDTap(rfidTag);

  // Update last tap time
  lastTapTime = millis();

  // Halt PICC
  rfid.PICC_HaltA();

  // Stop encryption on PCD
  rfid.PCD_StopCrypto1();
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.println("✅ WiFi connected successfully");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("");
    Serial.println("❌ WiFi connection failed");
    ESP.restart();
  }
}

String getRFIDTag() {
  String tag = "";

  // Convert UID bytes to string
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      tag += "0";
    }
    tag += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) {
      tag += ":";
    }
  }

  tag.toUpperCase();
  return tag;
}

void processRFIDTap(String rfidTag) {
  // Visual feedback
  digitalWrite(LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("");
  Serial.println("🎯 RFID Card Detected!");
  Serial.print("Card UID: ");
  Serial.println(rfidTag);

  // Check if this is a new card or continuation
  if (currentRFID != rfidTag) {
    // New card detected - reset tap count
    currentRFID = rfidTag;
    tapCount = 1;
    Serial.println("🆕 New RFID card detected - Tap count reset to 1");
  } else {
    // Same card - increment tap count
    tapCount++;
    Serial.print("🔄 Same card tapped again - Tap count: ");
    Serial.println(tapCount);
  }

  // Send data to Firebase
  sendRFIDToFirebase(rfidTag, tapCount);

  // Generate custom UID for display (same logic as original)
  String customUID = generateCustomUID(rfidTag);
  Serial.print("Custom UID: ");
  Serial.println(customUID);
  Serial.println("📤 Data sent to Firebase");
  Serial.println("");
}

void sendRFIDToFirebase(String rfidTag, int tapCount) {
  // Create unique path for each tap using timestamp
  String path = "/rfid_taps/" + String(millis());

  // Generate custom UID (same as original system)
  String customUID = generateCustomUID(rfidTag);

  // Create JSON data
  String jsonData = "{";
  jsonData += "\"card_uid\":\"" + rfidTag + "\",";
  jsonData += "\"custom_uid\":\"" + customUID + "\",";
  jsonData += "\"tap_count\":" + String(tapCount) + ",";
  jsonData += "\"timestamp\":" + String(millis()) + ",";
  jsonData += "\"device_info\":\"ESP32-RFID-Scanner\",";
  jsonData += "\"wifi_network\":\"" + String(WiFi.SSID()) + "\",";
  jsonData += "\"signal_strength\":" + String(WiFi.RSSI());
  jsonData += "}";

  Serial.print("Sending to Firebase path: ");
  Serial.println(path);
  Serial.print("Data: ");
  Serial.println(jsonData);

  // Send to Firebase
  if (Firebase.setJSON(fbdo, path, jsonData)) {
    Serial.println("✅ RFID data sent to Firebase successfully");

    // Get the push key for reference
    String pushKey = fbdo.pushName();
    if (pushKey != "") {
      Serial.print("Firebase push key: ");
      Serial.println(pushKey);
    }
  } else {
    Serial.println("❌ Failed to send RFID data to Firebase");
    Serial.println("Error: " + fbdo.errorReason());

    // Try to reconnect and retry once
    Serial.println("🔄 Attempting to reconnect to Firebase...");
    Firebase.reconnectWiFi(true);
    delay(1000);

    if (Firebase.setJSON(fbdo, path, jsonData)) {
      Serial.println("✅ RFID data sent to Firebase on retry");
    } else {
      Serial.println("❌ Firebase retry also failed");
    }
  }
}

String generateCustomUID(String cardUID) {
  // Simple hash function to generate 8-character custom UID
  // This matches the logic used in the original system
  unsigned long hash = 5381;
  for (char c : cardUID) {
    hash = ((hash << 5) + hash) + c; // hash * 33 + c
  }

  // Convert hash to 8-character string using base36
  String customUID = "";
  const char* chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  for (int i = 0; i < 8; i++) {
    customUID = chars[hash % 36] + customUID;
    hash /= 36;
  }

  return customUID;
}

void printFirebaseStatus() {
  Serial.println("");
  Serial.println("🔥 Firebase Status:");
  Serial.print("   Connected: ");
  Serial.println(Firebase.ready() ? "Yes" : "No");
  Serial.print("   WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
  Serial.print("   IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("");
}

/*
 * Setup Instructions:
 * 1. Replace YOUR_WIFI_SSID and YOUR_WIFI_PASSWORD with your WiFi credentials
 * 2. Upload this code to your ESP32
 * 3. Make sure Firebase project "animatesrfid" exists and Realtime Database is enabled
 * 4. The system will automatically read RFID data from Firebase
 *
 * Firebase Database Structure:
 * /rfid_taps/
 *   ├── timestamp1/
 *   │   ├── card_uid: "73:77:f8:39"
 *   │   ├── custom_uid: "A9VX8YPB"
 *   │   ├── tap_count: 1
 *   │   ├── timestamp: 1703123456789
 *   │   ├── device_info: "ESP32-RFID-Scanner"
 *   │   ├── wifi_network: "YourWiFi"
 *   │   └── signal_strength: -45
 *   └── timestamp2/
 *       └── ... (next tap)
 */