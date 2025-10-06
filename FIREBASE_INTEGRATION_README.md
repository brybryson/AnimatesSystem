# Firebase RFID Integration Setup Guide

## Overview

This guide explains how to migrate from the direct ESP32-to-API communication to a Firebase-based architecture that solves hosting provider blocking issues.

## Architecture Change

### Before (Problematic)
```
ESP32 RFID → Direct API Call → System API Endpoint
```
- **Issue**: Hosting providers (like InfinityFree) block direct ESP32-to-server communication
- **Limitation**: Requires stable, publicly accessible API endpoints

### After (Firebase-Based)
```
ESP32 RFID → Firebase Realtime Database → System API Endpoint
```
- **Solution**: ESP32 sends data to Firebase, system reads from Firebase
- **Advantage**: Firebase handles data storage and retrieval, bypassing hosting restrictions

## Setup Instructions

### 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or use existing "animatesrfid" project
3. Enable **Realtime Database**
4. Go to **Project Settings** → **Service Accounts**
5. Click **"Generate new private key"**
6. Download the JSON file

### 2. Replace Service Account File

1. Replace `config/firebase-service-account.json` with your downloaded Firebase service account JSON file
2. The file should contain your actual private key and credentials

### 3. Update ESP32 Arduino Code

Replace your current ESP32 code with Firebase integration:

```cpp
#include <WiFi.h>
#include <FirebaseESP32.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Firebase configuration
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

void setup() {
  Serial.begin(115200);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
  }
  Serial.println("WiFi connected");

  // Firebase configuration
  config.api_key = "AIzaSyBCqI4oN_ikpKRxeRSaCaopCnCCmBImZqA";
  config.database_url = "https://animatesrfid-default-rtdb.firebaseio.com/";

  // Initialize Firebase
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
}

void sendRFIDToFirebase(String rfidTag, int tapCount) {
  // Create unique path for each tap
  String path = "/rfid_taps/" + String(millis());

  // Create JSON data
  String jsonData = "{";
  jsonData += "\"custom_uid\":\"" + rfidTag + "\",";
  jsonData += "\"tap_count\":" + String(tapCount) + ",";
  jsonData += "\"timestamp\":" + String(millis()) + ",";
  jsonData += "\"card_uid\":\"" + rfidTag + "\"";  // You can add more fields
  jsonData += "}";

  // Send to Firebase
  if (Firebase.setJSON(fbdo, path, jsonData)) {
    Serial.println("RFID data sent to Firebase successfully");
  } else {
    Serial.println("Failed to send RFID data to Firebase");
    Serial.println(fbdo.errorReason());
  }
}

void loop() {
  // Your existing RFID reading logic here
  // When RFID is detected, call:
  // sendRFIDToFirebase(rfidTag, tapCount);
}
```

### 4. Firebase Database Structure

Your Firebase Realtime Database should have this structure:

```
/rfid_taps/
  ├── 1703123456789/
  │   ├── custom_uid: "A9VX8YPB"
  │   ├── tap_count: 1
  │   ├── timestamp: 1703123456789
  │   └── card_uid: "73:77:f8:39"
  └── 1703123456790/
      ├── custom_uid: "A9VX8YPB"
      ├── tap_count: 2
      ├── timestamp: 1703123456790
      └── card_uid: "73:77:f8:39"
```

### 5. Test Firebase Integration

Run the test script to verify Firebase connectivity:

```bash
php test_firebase.php
```

Expected output:
```
Testing Firebase Integration
============================

1. Testing Firebase connection...
✅ Firebase connection successful

2. Testing RFID data retrieval from Firebase...
✅ Successfully retrieved RFID data from Firebase
```

### 6. System Behavior

#### check_in.html
- Polls `api/rfid_endpoint.php?action=get_latest_rfid` every 1 second
- API reads latest RFID data from Firebase
- Automatically detects RFID taps for check-in process

#### appointments_manager.html
- Uses same RFID endpoint for RFID tag assignment
- Reads RFID data from Firebase instead of direct ESP32 communication

#### guest_dashboard.html
- RFID tap status updates work through Firebase data
- Real-time status progression: checked-in → bathing → grooming → ready → completed

## Key Benefits

1. **Hosting Provider Compatibility**: Works with restrictive hosting providers
2. **Real-time Data**: Firebase provides real-time data synchronization
3. **Scalability**: Firebase handles data storage and retrieval
4. **Reliability**: No direct ESP32-to-server communication issues
5. **Backup**: RFID data is stored in Firebase as backup

## Troubleshooting

### Firebase Connection Issues
- Verify service account JSON file is correct
- Check Firebase project settings
- Ensure Realtime Database is enabled

### RFID Not Detected
- Check ESP32 is sending data to correct Firebase path
- Verify Firebase database structure matches expected format
- Check system logs for Firebase read errors

### Status Updates Not Working
- Ensure booking exists with matching RFID tag
- Check Firebase data format matches system expectations
- Verify email notifications are configured

## Migration Checklist

- [ ] Firebase project created/enabled
- [ ] Service account JSON downloaded and placed in `config/firebase-service-account.json`
- [ ] ESP32 code updated to use Firebase
- [ ] Firebase test script passes
- [ ] RFID detection works in check_in.html
- [ ] RFID assignment works in appointments_manager.html
- [ ] Status updates work in guest dashboard

## Files Modified

- `config/firebase.php` - Firebase integration functions
- `config/firebase-service-account.json` - Service account credentials (REPLACE WITH REAL ONE)
- `api/rfid_endpoint.php` - Modified to read from Firebase
- `test_firebase.php` - Firebase testing script
- `arduino_rfid_improved.ino` - Update to use Firebase (separate file)

## Security Notes

- Keep Firebase service account JSON secure
- Use Firebase security rules to protect data
- Consider implementing authentication for production use
- Regularly rotate service account keys

---

**Note**: The existing API endpoints still function as fallbacks, but the primary data flow now goes through Firebase for better reliability with hosting providers.