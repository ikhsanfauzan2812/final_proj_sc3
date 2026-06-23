#include <Adafruit_BME680.h>
#include <Adafruit_Sensor.h>
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <time.h>

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

// IR Libraries
#include <ir_Daikin.h>
#include <ir_Fujitsu.h>
#include <ir_Gree.h>
#include <ir_Haier.h>
#include <ir_Hitachi.h>
#include <ir_LG.h>
#include <ir_Midea.h>
#include <ir_Mitsubishi.h>
#include <ir_MitsubishiHeavy.h>
#include <ir_Panasonic.h>
#include <ir_Samsung.h>
#include <ir_Sanyo.h>
#include <ir_Sharp.h>
#include <ir_Tcl.h>
#include <ir_Toshiba.h>
#include <ir_Whirlpool.h>

#include "WebDashboard.h"

// PIN
#define PIN_PIR_SENSOR 1
#define SDA_PIN 21
#define SCL_PIN 20

const uint16_t kIrLed = 10;

Adafruit_BME680 bme;
Preferences preferences;
WebServer server(80);

// LOG
const unsigned long LOG_DURATION = 3UL * 3600UL * 1000UL;
const unsigned long INTERVAL = 10000UL;       // 10 detik
const unsigned long CMD_INTERVAL = 5000UL;    // 5 detik (lebih longgar untuk SSL)
const unsigned long HEARTBEAT_INTERVAL = 20000UL; // 20 detik
const unsigned long CMD_BOOT_DELAY = 15000UL; // tunggu 15 detik setelah boot sebelum polling

unsigned long startTime;
unsigned long lastLogTime = 0;
unsigned long lastCmdTime = 0;
unsigned long lastHeartbeatTime = 0;
unsigned long cmdErrorCount = 0;  // hitung error berturut-turut untuk backoff
bool isLogging = true;

// Variabel Data Global
float g_temperature = 0.0;
float g_humidity = 0.0;
float g_pressure = 0.0;
float g_voc = 0.0;
int g_pir = 0;
char g_timestamp[25] = "-";

// Supabase Configuration
#include "secrets.h"

// ==============================
//  IR Remote (AC) configuration
// ==============================
IRSharpAc acSharp(kIrLed);
IRGreeAC acGree(kIrLed);
IRMideaAC acMidea(kIrLed);
IRSamsungAc acSamsung(kIrLed);
IRDaikinESP acDaikin(kIrLed);
IRFujitsuAC acFujitsu(kIrLed);
IRHaierAC acHaier(kIrLed);
IRHitachiAc acHitachi(kIrLed);
IRLgAc acLG(kIrLed);
IRMitsubishiAC acMitsubishi(kIrLed);
IRMitsubishiHeavy88Ac acMitsubishiHeavy(kIrLed);
IRPanasonicAc acPanasonic(kIrLed);
IRSanyoAc acSanyo(kIrLed);
IRTcl112Ac acTcl(kIrLed);
IRToshibaAC acToshiba(kIrLed);
IRWhirlpoolAc acWhirlpool(kIrLed);

String savedModel = "SHARP:A907";

// ==============================
//  Helper / enums
// ==============================
sharp_ac_remote_model_t sharpModelFromString(const String &s) {
  if (s.equalsIgnoreCase("A705"))
    return sharp_ac_remote_model_t::A705;
  if (s.equalsIgnoreCase("A903"))
    return sharp_ac_remote_model_t::A903;
  return sharp_ac_remote_model_t::A907;
}

enum IRCmdType { IR_CMD_AC_ON, IR_CMD_AC_OFF, IR_CMD_AC_SET };
struct IRCommand {
  IRCmdType type;
  String modelStr;
  int temp;
  String mode;
  String fan;
  String power;
};

static QueueHandle_t irQueue = NULL;

void irTask(void *pv) {
  IRCommand cmd;
  for (;;) {
    if (xQueueReceive(irQueue, &cmd, portMAX_DELAY) == pdTRUE) {
      if (cmd.type == IR_CMD_AC_SET) {
        Serial.printf(
            "SEND SET -> model=%s, temp=%d, mode=%s, fan=%s, power=%s\n",
            cmd.modelStr.c_str(), cmd.temp, cmd.mode.c_str(), cmd.fan.c_str(),
            cmd.power.c_str());
        Serial.flush();

        bool isOff = (cmd.power == "off");

        if (cmd.modelStr.startsWith("SHARP")) {
          int colon = cmd.modelStr.indexOf(':');
          String sub =
              (colon >= 0) ? cmd.modelStr.substring(colon + 1) : "A907";
          acSharp.setModel(sharpModelFromString(sub));

          if (isOff)
            acSharp.off();
          else
            acSharp.on();

          acSharp.setTemp(cmd.temp);
          if (cmd.mode == "cool")
            acSharp.setMode(kSharpAcCool);
          else if (cmd.mode == "dry")
            acSharp.setMode(kSharpAcDry);
          else if (cmd.mode == "fan")
            acSharp.setMode(kSharpAcFan);

          if (cmd.fan == "high")
            acSharp.setFan(kSharpAcFanHigh);
          else if (cmd.fan == "low")
            acSharp.setFan(kSharpAcFanMin);
          else
            acSharp.setFan(kSharpAcFanAuto);

          acSharp.send();

        } else if (cmd.modelStr.startsWith("GREE")) {
          if (isOff)
            acGree.off();
          else
            acGree.on();

          acGree.setTemp(cmd.temp);
          if (cmd.mode == "cool")
            acGree.setMode(kGreeCool);
          else if (cmd.mode == "dry")
            acGree.setMode(kGreeDry);
          else if (cmd.mode == "fan")
            acGree.setMode(kGreeFan);
          else
            acGree.setMode(kGreeAuto);

          if (cmd.fan == "high")
            acGree.setFan(3);
          else if (cmd.fan == "low")
            acGree.setFan(1);
          else
            acGree.setFan(0); // auto

          acGree.send();

        } else if (cmd.modelStr.startsWith("MIDEA")) {
          if (isOff)
            acMidea.off();
          else
            acMidea.on();

          acMidea.setTemp(cmd.temp);
          if (cmd.mode == "cool")
            acMidea.setMode(kMideaACCool);
          else if (cmd.mode == "dry")
            acMidea.setMode(kMideaACDry);
          else if (cmd.mode == "fan")
            acMidea.setMode(kMideaACFan);

          if (cmd.fan == "high")
            acMidea.setFan(kMideaACFanHigh);
          else if (cmd.fan == "low")
            acMidea.setFan(kMideaACFanLow);
          else
            acMidea.setFan(kMideaACFanAuto);

          acMidea.send();

        } else if (cmd.modelStr.startsWith("SAMSUNG")) {
          if (isOff)
            acSamsung.off();
          else
            acSamsung.on();

          acSamsung.setTemp(cmd.temp);
          if (cmd.mode == "cool")
            acSamsung.setMode(kSamsungAcCool);
          else if (cmd.mode == "dry")
            acSamsung.setMode(kSamsungAcDry);
          else if (cmd.mode == "fan")
            acSamsung.setMode(kSamsungAcFan);

          if (cmd.fan == "high")
            acSamsung.setFan(kSamsungAcFanHigh);
          else if (cmd.fan == "low")
            acSamsung.setFan(kSamsungAcFanLow);
          else
            acSamsung.setFan(kSamsungAcFanAuto);

          acSamsung.send();

        } else if (cmd.modelStr.startsWith("DAIKIN")) {
          if (isOff) acDaikin.off(); else acDaikin.on();
          acDaikin.setTemp(cmd.temp);
          if (cmd.mode == "cool") acDaikin.setMode(kDaikinCool);
          else if (cmd.mode == "dry") acDaikin.setMode(kDaikinDry);
          else if (cmd.mode == "fan") acDaikin.setMode(kDaikinFan);
          else acDaikin.setMode(kDaikinAuto);
          if (cmd.fan == "high") acDaikin.setFan(kDaikinFanMax);
          else if (cmd.fan == "low") acDaikin.setFan(kDaikinFanMin);
          else acDaikin.setFan(kDaikinFanAuto);
          acDaikin.send();

        } else if (cmd.modelStr.startsWith("FUJITSU")) {
          if (isOff) acFujitsu.off(); else acFujitsu.on();
          acFujitsu.setTemp(cmd.temp);
          if (cmd.mode == "cool") acFujitsu.setMode(kFujitsuAcModeCool);
          else if (cmd.mode == "dry") acFujitsu.setMode(kFujitsuAcModeDry);
          else if (cmd.mode == "fan") acFujitsu.setMode(kFujitsuAcModeFan);
          else acFujitsu.setMode(kFujitsuAcModeAuto);
          if (cmd.fan == "high") acFujitsu.setFanSpeed(kFujitsuAcFanHigh);
          else if (cmd.fan == "low") acFujitsu.setFanSpeed(kFujitsuAcFanLow);
          else acFujitsu.setFanSpeed(kFujitsuAcFanAuto);
          acFujitsu.send();

        } else if (cmd.modelStr.startsWith("HAIER")) {
          acHaier.setTemp(cmd.temp);
          if (isOff || cmd.mode == "fan") acHaier.setMode(kHaierAcFan);
          else if (cmd.mode == "cool") acHaier.setMode(kHaierAcCool);
          else if (cmd.mode == "dry") acHaier.setMode(kHaierAcDry);
          else acHaier.setMode(kHaierAcCool);
          if (cmd.fan == "high") acHaier.setFan(kHaierAcFanHigh);
          else if (cmd.fan == "low") acHaier.setFan(kHaierAcFanLow);
          else acHaier.setFan(kHaierAcFanAuto);
          acHaier.send();

        } else if (cmd.modelStr.startsWith("HITACHI")) {
          acHitachi.setTemp(cmd.temp);
          if (isOff || cmd.mode == "fan") acHitachi.setMode(kHitachiAcFan);
          else if (cmd.mode == "cool") acHitachi.setMode(kHitachiAcCool);
          else if (cmd.mode == "dry") acHitachi.setMode(kHitachiAcDry);
          else acHitachi.setMode(kHitachiAcCool);
          if (cmd.fan == "high") acHitachi.setFan(kHitachiAcFanHigh);
          else if (cmd.fan == "low") acHitachi.setFan(kHitachiAcFanLow);
          else acHitachi.setFan(kHitachiAcFanAuto);
          acHitachi.send();

        } else if (cmd.modelStr.startsWith("LG")) {
          if (isOff) acLG.off(); else acLG.on();
          acLG.setTemp(cmd.temp);
          if (cmd.mode == "cool") acLG.setMode(kLgAcCool);
          else if (cmd.mode == "dry") acLG.setMode(kLgAcDry);
          else if (cmd.mode == "fan") acLG.setMode(kLgAcFan);
          else acLG.setMode(kLgAcAuto);
          if (cmd.fan == "high") acLG.setFan(kLgAcFanHigh);
          else if (cmd.fan == "low") acLG.setFan(kLgAcFanLow);
          else acLG.setFan(kLgAcFanAuto);
          acLG.send();

        } else if (cmd.modelStr.startsWith("SANYO")) {
          acSanyo.setPower(!isOff);
          acSanyo.setTemp(cmd.temp);
          if (cmd.mode == "cool") acSanyo.setMode(kSanyoAcCool);
          else if (cmd.mode == "dry") acSanyo.setMode(kSanyoAcDry);
          else acSanyo.setMode(kSanyoAcAuto);
          if (cmd.fan == "high") acSanyo.setFan(kSanyoAcFanHigh);
          else if (cmd.fan == "low") acSanyo.setFan(kSanyoAcFanLow);
          else acSanyo.setFan(kSanyoAcFanAuto);
          acSanyo.send();

        } else if (cmd.modelStr.startsWith("MITSUBISHI_HEAVY")) {
          if (isOff) acMitsubishiHeavy.off(); else acMitsubishiHeavy.on();
          acMitsubishiHeavy.setTemp(cmd.temp);
          if (cmd.mode == "cool") acMitsubishiHeavy.setMode(kMitsubishiHeavyCool);
          else if (cmd.mode == "dry") acMitsubishiHeavy.setMode(kMitsubishiHeavyDry);
          else if (cmd.mode == "fan") acMitsubishiHeavy.setMode(kMitsubishiHeavyFan);
          else acMitsubishiHeavy.setMode(kMitsubishiHeavyAuto);
          if (cmd.fan == "high") acMitsubishiHeavy.setFan(kMitsubishiHeavy88FanHigh);
          else if (cmd.fan == "low") acMitsubishiHeavy.setFan(kMitsubishiHeavy88FanLow);
          else acMitsubishiHeavy.setFan(kMitsubishiHeavy88FanAuto);
          acMitsubishiHeavy.send();

        } else if (cmd.modelStr.startsWith("MITSUBISHI")) {
          if (isOff) acMitsubishi.off(); else acMitsubishi.on();
          acMitsubishi.setTemp(cmd.temp);
          if (cmd.mode == "cool") acMitsubishi.setMode(kMitsubishiAcCool);
          else if (cmd.mode == "dry") acMitsubishi.setMode(kMitsubishiAcDry);
          else if (cmd.mode == "fan") acMitsubishi.setMode(kMitsubishiAcFan);
          else acMitsubishi.setMode(kMitsubishiAcAuto);
          if (cmd.fan == "high") acMitsubishi.setFan(kMitsubishiAcFanMax);
          else if (cmd.fan == "low") acMitsubishi.setFan(kMitsubishiAcFanSilent);
          else acMitsubishi.setFan(kMitsubishiAcFanAuto);
          acMitsubishi.send();

        } else if (cmd.modelStr.startsWith("PANASONIC")) {
          if (isOff) acPanasonic.off(); else acPanasonic.on();
          acPanasonic.setTemp(cmd.temp);
          if (cmd.mode == "cool") acPanasonic.setMode(kPanasonicAcCool);
          else if (cmd.mode == "dry") acPanasonic.setMode(kPanasonicAcDry);
          else if (cmd.mode == "fan") acPanasonic.setMode(kPanasonicAcFan);
          else acPanasonic.setMode(kPanasonicAcAuto);
          if (cmd.fan == "high") acPanasonic.setFan(kPanasonicAcFanMax);
          else if (cmd.fan == "low") acPanasonic.setFan(kPanasonicAcFanMin);
          else acPanasonic.setFan(kPanasonicAcFanAuto);
          acPanasonic.send();

        } else if (cmd.modelStr.startsWith("TCL")) {
          if (isOff) acTcl.off(); else acTcl.on();
          acTcl.setTemp(cmd.temp);
          if (cmd.mode == "cool") acTcl.setMode(kTcl112AcCool);
          else if (cmd.mode == "dry") acTcl.setMode(kTcl112AcDry);
          else if (cmd.mode == "fan") acTcl.setMode(kTcl112AcFan);
          else acTcl.setMode(kTcl112AcAuto);
          if (cmd.fan == "high") acTcl.setFan(kTcl112AcFanHigh);
          else if (cmd.fan == "low") acTcl.setFan(kTcl112AcFanLow);
          else acTcl.setFan(kTcl112AcFanAuto);
          acTcl.send();

        } else if (cmd.modelStr.startsWith("TOSHIBA")) {
          if (isOff) acToshiba.off(); else acToshiba.on();
          acToshiba.setTemp(cmd.temp);
          if (cmd.mode == "cool") acToshiba.setMode(kToshibaAcCool);
          else if (cmd.mode == "dry") acToshiba.setMode(kToshibaAcDry);
          else if (cmd.mode == "fan") acToshiba.setMode(kToshibaAcFan);
          else acToshiba.setMode(kToshibaAcAuto);
          if (cmd.fan == "high") acToshiba.setFan(kToshibaAcFanMax);
          else if (cmd.fan == "low") acToshiba.setFan(kToshibaAcFanMin);
          else acToshiba.setFan(kToshibaAcFanAuto);
          acToshiba.send();

        } else if (cmd.modelStr.startsWith("WHIRLPOOL")) {
          acWhirlpool.setCommand(kWhirlpoolAcCommandPower);
          acWhirlpool.setPowerToggle(isOff ? false : true);
          acWhirlpool.setTemp(cmd.temp);
          if (cmd.mode == "cool") acWhirlpool.setMode(kWhirlpoolAcCool);
          else if (cmd.mode == "dry") acWhirlpool.setMode(kWhirlpoolAcDry);
          else if (cmd.mode == "fan") acWhirlpool.setMode(kWhirlpoolAcFan);
          else acWhirlpool.setMode(kWhirlpoolAcAuto);
          if (cmd.fan == "high") acWhirlpool.setFan(kWhirlpoolAcFanHigh);
          else if (cmd.fan == "low") acWhirlpool.setFan(kWhirlpoolAcFanLow);
          else acWhirlpool.setFan(kWhirlpoolAcFanAuto);
          acWhirlpool.send();
        }
      } else if (cmd.type == IR_CMD_AC_ON) {
        Serial.printf("SEND ON -> model=%s\n", cmd.modelStr.c_str());
        Serial.flush();

        if (cmd.modelStr.startsWith("SHARP")) {
          int colon = cmd.modelStr.indexOf(':');
          String sub =
              (colon >= 0) ? cmd.modelStr.substring(colon + 1) : "A907";
          acSharp.setModel(sharpModelFromString(sub));
          acSharp.on();
          acSharp.setMode(kSharpAcCool);
          acSharp.setTemp(16);
          acSharp.setFan(kSharpAcFanHigh);
          acSharp.send();
        } else if (cmd.modelStr.startsWith("GREE")) {
          acGree.on();
          acGree.setMode(kGreeCool);
          acGree.setTemp(16);
          acGree.setFan(1); // 1 is usually High/Auto for Gree
          acGree.send();
        } else if (cmd.modelStr.startsWith("MIDEA")) {
          acMidea.on();
          acMidea.setMode(kMideaACCool);
          acMidea.setTemp(16);
          acMidea.setFan(kMideaACFanHigh);
          acMidea.send();
        } else if (cmd.modelStr.startsWith("SAMSUNG")) {
          acSamsung.on();
          acSamsung.setMode(kSamsungAcCool);
          acSamsung.setTemp(16);
          acSamsung.setFan(kSamsungAcFanHigh);
          acSamsung.send();
        }
      } else {
        Serial.printf("SEND OFF -> model=%s\n", cmd.modelStr.c_str());
        Serial.flush();

        if (cmd.modelStr.startsWith("SHARP")) {
          acSharp.off();
          acSharp.send();
        } else if (cmd.modelStr.startsWith("GREE")) {
          acGree.off();
          acGree.send();
        } else if (cmd.modelStr.startsWith("MIDEA")) {
          acMidea.off();
          acMidea.send();
        } else if (cmd.modelStr.startsWith("SAMSUNG")) {
          acSamsung.off();
          acSamsung.send();
        }
      }
      vTaskDelay(pdMS_TO_TICKS(100)); // Beri nafas untuk Wi-Fi
    }
  }
  vTaskDelete(NULL);
}

void sendAutoOnFromModelString(const String &modelStr) {
  if (irQueue) {
    IRCommand cmd;
    cmd.type = IR_CMD_AC_ON;
    cmd.modelStr = modelStr;
    xQueueSend(irQueue, &cmd, 0);
  }
}

void sendAutoOffFromModelString(const String &modelStr) {
  if (irQueue) {
    IRCommand cmd;
    cmd.type = IR_CMD_AC_OFF;
    cmd.modelStr = modelStr;
    xQueueSend(irQueue, &cmd, 0);
  }
}

// ==============================
void setupTime() {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  struct tm timeinfo;
  Serial.print("Sync time");
  for (int i = 0; i < 20; i++) {
    if (getLocalTime(&timeinfo)) {
      Serial.println("\n[OK] Time synced!");
      return;
    }
    Serial.print(".");
    delay(500);
  }
  Serial.println("\n[WARN] Time sync failed!");
}

void registerDevice() {
  if (WiFi.status() != WL_CONNECTED) return;

  static WiFiClientSecure client;
  static bool clientReady = false;
  if (!clientReady) {
    client.setInsecure();
    clientReady = true;
  }

  // Buat timestamp UTC dari NTP
  time_t now_utc = time(nullptr);
  struct tm *utc_tm = gmtime(&now_utc);
  char isoTime[30] = "";
  if (now_utc > 1000000000) {
    strftime(isoTime, sizeof(isoTime), "%Y-%m-%dT%H:%M:%SZ", utc_tm);
  }
  Serial.printf("[Heartbeat] Timestamp UTC: %s\n", isoTime);

  // Encode MAC address untuk URL query parameter
  String macEncoded = WiFi.macAddress();
  macEncoded.replace(":", "%3A");

  // PATCH ke Supabase: update last_seen dan status
  HTTPClient http;
  String url = String(supabase_device_url) + "?mac_address=eq." + macEncoded;
  Serial.printf("[Heartbeat] URL: %s\n", url.c_str());

  if (http.begin(client, url)) {
    http.addHeader("apikey", supabase_key);
    http.addHeader("Authorization", String("Bearer ") + supabase_key);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Prefer", "return=representation");

    JsonDocument doc;
    if (strlen(isoTime) > 0) doc["last_seen"] = isoTime;
    doc["status"] = "online";
    String payload;
    serializeJson(doc, payload);
    Serial.printf("[Heartbeat] Payload: %s\n", payload.c_str());

    int httpCode = http.PATCH(payload);
    String response = http.getString();
    Serial.printf("[Heartbeat] HTTP: %d, Response: %s\n", httpCode, response.c_str());
    http.end();
  }
}

void getTimestamp(char *buffer) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    sprintf(buffer, "%lu", millis() / 1000);
    return;
  }
  strftime(buffer, 25, "%Y-%m-%d %H:%M:%S", &timeinfo);
}

// ==============================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("=== LOGGER & DASHBOARD START ===");

  pinMode(PIN_PIR_SENSOR, INPUT);
  Wire.begin(SDA_PIN, SCL_PIN);

  if (!bme.begin()) {
    Serial.println("[ERROR] BME680 tidak terdeteksi!");
  } else {
    Serial.println("[OK] BME680 OK");
    bme.setTemperatureOversampling(BME680_OS_8X);
    bme.setHumidityOversampling(BME680_OS_2X);
    bme.setPressureOversampling(BME680_OS_4X);
    bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
    bme.setGasHeater(280, 80);
  }

  // Load Preferences
  preferences.begin("wifi_config", false);
  // JANGAN clear() di sini — akan menghapus WiFi credentials yang tersimpan

  // Jika NVS kosong (pertama kali boot), simpan nilai default agar tidak muncul error NOT_FOUND
  if (!preferences.isKey("ssid")) {
    preferences.putString("ssid", "BURJO");
    Serial.println("[NVS] SSID default disimpan.");
  }
  if (!preferences.isKey("password")) {
    preferences.putString("password", "janganlupabayar");
    Serial.println("[NVS] Password default disimpan.");
  }
  if (!preferences.isKey("ac_model")) {
    preferences.putString("ac_model", "SHARP:A907");
    Serial.println("[NVS] AC model default disimpan.");
  }

  String ssid = preferences.getString("ssid", "BURJO");
  String password = preferences.getString("password", "janganlupabayar");
  savedModel = preferences.getString("ac_model", "SHARP:A907");

  // Init IR
  acSharp.begin();
  acGree.begin();
  acMidea.begin();
  acSamsung.begin();
  acDaikin.begin();
  acFujitsu.begin();
  acHaier.begin();
  acHitachi.begin();
  acLG.begin();
  acMitsubishi.begin();
  acMitsubishiHeavy.begin();
  acPanasonic.begin();
  acSanyo.begin();
  acTcl.begin();
  acToshiba.begin();
  acWhirlpool.begin();

  irQueue = xQueueCreate(8, sizeof(IRCommand));
  if (irQueue) {
    // Tambah ukuran stack dari 4096 ke 8192 untuk mendukung library yang berat
    xTaskCreate(irTask, "irTask", 8192, NULL, 5, NULL);
  }

  Serial.printf("Mencoba konek ke WiFi: %s\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OK] WiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("[INFO] MAC Address ESP32: ");
    Serial.println(WiFi.macAddress());  // <-- MAC fisik akan tercetak di sini
    setupTime();
    registerDevice();
  } else {
    Serial.println("\n[WARN] WiFi Failed. Starting AP Mode...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.softAP("ClimateController", "12345678");
  }

  // Routes
  server.on("/", HTTP_GET, []() {
    String html = htmlPage;
    html.replace("{{SAVED_MODEL}}", savedModel);
    server.send(200, "text/html", html);
  });

  server.on("/api/data", HTTP_GET, []() {
    JsonDocument doc;
    doc["temperature"] = g_temperature;
    doc["humidity"] = g_humidity;
    doc["pressure"] = g_pressure;
    doc["voc"] = g_voc;
    doc["pir"] = g_pir;
    doc["timestamp"] = g_timestamp;
    doc["ac_model"] = savedModel;

    if (WiFi.status() == WL_CONNECTED) {
      doc["ip_address"] = WiFi.localIP().toString();
    } else {
      doc["ip_address"] = "AP: " + WiFi.softAPIP().toString();
    }
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });

  server.on("/api/wifi", HTTP_POST, []() {
    if (server.hasArg("ssid")) {
      preferences.putString("ssid", server.arg("ssid"));
      preferences.putString("password", server.arg("password"));
      server.send(200, "text/plain", "OK");
      delay(1000);
      ESP.restart();
    } else
      server.send(400, "text/plain", "Bad Request");
  });

  server.on("/api/ac/model", HTTP_POST, []() {
    if (server.hasArg("model")) {
      savedModel = server.arg("model");
      preferences.putString("ac_model", savedModel);
      server.send(200, "application/json", "{\"status\":\"ok\"}");
    } else
      server.send(400, "text/plain", "Bad Request");
  });

  server.on("/api/ac/test-on", HTTP_POST, []() {
    sendAutoOnFromModelString(savedModel);
    server.send(200, "application/json", "{\"status\":\"ok\"}");
  });

  server.on("/api/ac/test-off", HTTP_POST, []() {
    sendAutoOffFromModelString(savedModel);
    server.send(200, "application/json", "{\"status\":\"ok\"}");
  });

  server.begin();
  Serial.println("[OK] Web Server Started");
  Serial.println("\nTimestamp,temperature,humidity,pressure,voc,pir");
  startTime = millis();
}

// ==============================
void loop() {
  server.handleClient();

  // WiFi Reconnect: jika tidak terhubung, coba reconnect setiap 30 detik
  // Ini memungkinkan ESP32 menerima command SET_WIFI baru meski WiFi sebelumnya salah
  static unsigned long lastReconnectAttempt = 0;
  if (WiFi.status() != WL_CONNECTED && millis() - lastReconnectAttempt >= 30000UL) {
    lastReconnectAttempt = millis();
    String currentSsid = preferences.getString("ssid", "");
    String currentPass = preferences.getString("password", "");
    Serial.printf("[WiFi] Mencoba reconnect ke: %s\n", currentSsid.c_str());
    WiFi.disconnect();
    WiFi.begin(currentSsid.c_str(), currentPass.c_str());

    // Tunggu maksimal 10 detik untuk konek
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 20) {
      delay(500);
      tries++;
    }
    if (WiFi.status() == WL_CONNECTED) {
      Serial.printf("[WiFi] Reconnect berhasil! IP: %s\n", WiFi.localIP().toString().c_str());
      setupTime();
      registerDevice();
    } else {
      Serial.println("[WiFi] Reconnect gagal, akan coba lagi dalam 30 detik.");
    }
  }

  if (isLogging && millis() - startTime >= LOG_DURATION) {
    Serial.println("=== AUTO STOP LOGGING ===");
    isLogging = false;
  }

  if (isLogging && millis() - lastLogTime >= INTERVAL) {
    lastLogTime = millis();

    if (!bme.performReading()) {
      Serial.println("ERROR,0,0,0,0,0");
      return;
    }

    getTimestamp(g_timestamp);
    g_temperature = bme.temperature;
    g_humidity = bme.humidity;
    g_pressure = bme.pressure;
    g_voc = bme.gas_resistance / 1000.0;

    // Auto-trigger AC is removed based on user request.
    // We only read PIR status for logging.
    // TESTING MODE: PIR di-override ke 1 karena sensor fisik bermasalah
    // TODO: Kembalikan ke digitalRead(PIN_PIR_SENSOR) setelah sensor diperbaiki
    g_pir = 1;

    Serial.printf("%s,%.2f,%.2f,%.0f,%.2f,%d\n", g_timestamp, g_temperature,
                  g_humidity, g_pressure, g_voc, g_pir);

    // Send to Supabase
    if (WiFi.status() == WL_CONNECTED) {
      static WiFiClientSecure client;
      static bool isClientSetup = false;
      if (!isClientSetup) {
        client.setInsecure(); // Skip certificate validation for IoT
        isClientSetup = true;
      }

      HTTPClient http;
      http.setReuse(true); // Gunakan Keep-Alive agar tidak kena limit Supabase
      if (http.begin(client, supabase_url)) {
        http.addHeader("apikey", supabase_key);
        http.addHeader("Authorization", String("Bearer ") + supabase_key);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("Prefer", "return=minimal");

        JsonDocument doc;
        doc["mac_address"] = WiFi.macAddress();
        doc["temperature"] = g_temperature;
        doc["humidity"] = g_humidity;
        doc["pressure"] = g_pressure;
        doc["voc"] = g_voc;
        doc["pir"] = g_pir;

        String jsonPayload;
        serializeJson(doc, jsonPayload);

        int httpCode = http.POST(jsonPayload);
        if (httpCode > 0) {
          if (httpCode == 201) {
            Serial.println("[Supabase] Data terkirim sukses!");
          } else {
            Serial.printf("[Supabase] Terkirim dengan kode HTTP: %d\n",
                          httpCode);
          }
        } else {
          Serial.printf("[Supabase] Gagal mengirim data, error: %s\n",
                        http.errorToString(httpCode).c_str());
        }
        http.end();
      } else {
        Serial.println("[Supabase] Gagal membuat koneksi HTTP");
      }
    }
  }

  // Heartbeat: update last_seen di tabel devices setiap 60 detik
  // Ini yang digunakan dashboard untuk deteksi device aktif/mati
  if (WiFi.status() == WL_CONNECTED && millis() - lastHeartbeatTime >= HEARTBEAT_INTERVAL) {
    lastHeartbeatTime = millis();
    registerDevice(); // registerDevice() sudah melakukan upsert dengan last_seen
  }

  // Supabase Command Poller
  // Tunggu CMD_BOOT_DELAY setelah boot agar SSL stack stabil
  // Jika ada error berturut-turut, terapkan exponential backoff
  unsigned long cmdEffectiveInterval = CMD_INTERVAL * (1 + min(cmdErrorCount, 5UL));
  if (WiFi.status() == WL_CONNECTED && 
      millis() > CMD_BOOT_DELAY &&
      millis() - lastCmdTime >= cmdEffectiveInterval) {
    lastCmdTime = millis();

    // Buat WiFiClientSecure baru setiap request untuk menghindari SSL session expired
    WiFiClientSecure cmdClient;
    cmdClient.setInsecure();
    cmdClient.setTimeout(10); // timeout 10 detik

    HTTPClient http;
    // Jangan reuse connection untuk command poller agar SSL tidak stale
    String url = String(supabase_cmd_url) +
                 "?select=*&status=eq.pending&mac_address=eq." + WiFi.macAddress() + "&order=created_at.asc&limit=1";
    if (http.begin(cmdClient, url)) {
      http.addHeader("apikey", supabase_key);
      http.addHeader("Authorization", String("Bearer ") + supabase_key);

      int httpCode = http.GET();
      if (httpCode > 0) {
        cmdErrorCount = 0; // reset error count saat berhasil
        if (httpCode == 200) {
          String payload = http.getString();
          if (payload != "[]" && payload.length() > 2) {
            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, payload);
            if (!err && doc.size() > 0) {
              long cmdId = doc[0]["id"];
              String command = doc[0]["command"];
              String cmdPayload = doc[0]["payload"];

              Serial.printf(
                  "\n[Cloud Command] Menerima ID: %ld, CMD: %s, PAYLOAD: %s\n",
                  cmdId, command.c_str(), cmdPayload.c_str());

              bool needsRestart = false;

              if (command == "AC_ON") {
                sendAutoOnFromModelString(cmdPayload);
              } else if (command == "AC_OFF") {
                sendAutoOffFromModelString(cmdPayload);
              } else if (command == "SET_WIFI") {
                JsonDocument wdoc;
                DeserializationError werr = deserializeJson(wdoc, cmdPayload);
                if (!werr) {
                  String newSsid = wdoc["ssid"] | "";
                  String newPass = wdoc["password"] | "";
                  if (newSsid.length() > 0) {
                    preferences.putString("ssid", newSsid);
                    preferences.putString("password", newPass);
                    Serial.printf("[Cloud Command] WiFi credentials disimpan: %s\n", newSsid.c_str());
                    needsRestart = true; // restart SETELAH PATCH executed
                  }
                }
              } else if (command == "SET_AC") {
                JsonDocument pdoc;
                DeserializationError perr = deserializeJson(pdoc, cmdPayload);
                if (!perr) {
                  IRCommand irCmd;
                  irCmd.type = IR_CMD_AC_SET;
                  irCmd.modelStr = pdoc["model"] | "GREE";
                  irCmd.temp = pdoc["temp"] | 22;
                  irCmd.mode = pdoc["mode"] | "cool";
                  irCmd.fan = pdoc["fan"] | "auto";
                  irCmd.power = pdoc["power"] | "on";
                  xQueueSend(irQueue, &irCmd, 0);
                } else {
                  Serial.printf("[Cloud Command] JSON Payload Error: %s\n",
                                perr.c_str());
                }
              }
              // Tandai sebagai dieksekusi (PATCH)
              HTTPClient patchHttp;
              patchHttp.setReuse(true);
              String patchUrl =
                  String(supabase_cmd_url) + "?id=eq." + String(cmdId);
              if (patchHttp.begin(cmdClient, patchUrl)) {
                patchHttp.addHeader("apikey", supabase_key);
                patchHttp.addHeader("Authorization",
                                    String("Bearer ") + supabase_key);
                patchHttp.addHeader("Content-Type", "application/json");
                // PATCH requests need Prefer: return=minimal for Supabase if we
                // don't need body back
                patchHttp.addHeader("Prefer", "return=minimal");

                int pCode = patchHttp.PATCH("{\"status\":\"executed\"}");
                if (pCode == 204 || pCode == 200) {
                  Serial.println("[Cloud Command] Status berhasil diubah ke 'executed'");
                } else {
                  Serial.printf("[Cloud Command] Gagal PATCH status, HTTP: %d\n", pCode);
                }
                patchHttp.end();
              }

              // Restart SETELAH PATCH executed berhasil — mencegah infinite loop
              if (needsRestart) {
                Serial.println("[Cloud Command] Restarting ESP32 untuk konek ke WiFi baru...");
                delay(1000);
                ESP.restart();
              }
            }
          }
        }
      } else {
        cmdErrorCount++;
        Serial.printf("[Cloud Command] Gagal GET, error: %s (error #%lu)\n",
                      http.errorToString(httpCode).c_str(), cmdErrorCount);
      }
      http.end();
    }
  }
}