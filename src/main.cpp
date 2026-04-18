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
#include <ir_Sharp.h>
#include <ir_Gree.h>
#include <ir_Midea.h>
#include <ir_Samsung.h>

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
const unsigned long INTERVAL = 10000UL; // 10 detik
const unsigned long CMD_INTERVAL = 3000UL; // 3 detik

unsigned long startTime;
unsigned long lastLogTime = 0;
unsigned long lastCmdTime = 0;
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
        Serial.printf("SEND SET -> model=%s, temp=%d, mode=%s, fan=%s, power=%s\n", 
          cmd.modelStr.c_str(), cmd.temp, cmd.mode.c_str(), cmd.fan.c_str(), cmd.power.c_str());
        Serial.flush();
        
        bool isOff = (cmd.power == "off");

        if (cmd.modelStr.startsWith("SHARP")) {
          int colon = cmd.modelStr.indexOf(':');
          String sub = (colon >= 0) ? cmd.modelStr.substring(colon + 1) : "A907";
          acSharp.setModel(sharpModelFromString(sub));
          
          if (isOff) acSharp.off();
          else acSharp.on();
          
          acSharp.setTemp(cmd.temp);
          if (cmd.mode == "cool") acSharp.setMode(kSharpAcCool);
          else if (cmd.mode == "dry") acSharp.setMode(kSharpAcDry);
          else if (cmd.mode == "fan") acSharp.setMode(kSharpAcFan);
          
          if (cmd.fan == "high") acSharp.setFan(kSharpAcFanHigh);
          else if (cmd.fan == "low") acSharp.setFan(kSharpAcFanMin);
          else acSharp.setFan(kSharpAcFanAuto);
          
          acSharp.send();
          
        } else if (cmd.modelStr.startsWith("GREE")) {
          if (isOff) acGree.off();
          else acGree.on();
          
          acGree.setTemp(cmd.temp);
          if (cmd.mode == "cool") acGree.setMode(kGreeCool);
          else if (cmd.mode == "dry") acGree.setMode(kGreeDry);
          else if (cmd.mode == "fan") acGree.setMode(kGreeFan);
          else acGree.setMode(kGreeAuto);
          
          if (cmd.fan == "high") acGree.setFan(3);
          else if (cmd.fan == "low") acGree.setFan(1);
          else acGree.setFan(0); // auto
          
          acGree.send();
          
        } else if (cmd.modelStr.startsWith("MIDEA")) {
          if (isOff) acMidea.off();
          else acMidea.on();
          
          acMidea.setTemp(cmd.temp);
          if (cmd.mode == "cool") acMidea.setMode(kMideaACCool);
          else if (cmd.mode == "dry") acMidea.setMode(kMideaACDry);
          else if (cmd.mode == "fan") acMidea.setMode(kMideaACFan);
          
          if (cmd.fan == "high") acMidea.setFan(kMideaACFanHigh);
          else if (cmd.fan == "low") acMidea.setFan(kMideaACFanLow);
          else acMidea.setFan(kMideaACFanAuto);
          
          acMidea.send();
          
        } else if (cmd.modelStr.startsWith("SAMSUNG")) {
          if (isOff) acSamsung.off();
          else acSamsung.on();
          
          acSamsung.setTemp(cmd.temp);
          if (cmd.mode == "cool") acSamsung.setMode(kSamsungAcCool);
          else if (cmd.mode == "dry") acSamsung.setMode(kSamsungAcDry);
          else if (cmd.mode == "fan") acSamsung.setMode(kSamsungAcFan);
          
          if (cmd.fan == "high") acSamsung.setFan(kSamsungAcFanHigh);
          else if (cmd.fan == "low") acSamsung.setFan(kSamsungAcFanLow);
          else acSamsung.setFan(kSamsungAcFanAuto);
          
          acSamsung.send();
        }
      } else if (cmd.type == IR_CMD_AC_ON) {
        Serial.printf("SEND ON -> model=%s\n", cmd.modelStr.c_str());
        Serial.flush();
        
        if (cmd.modelStr.startsWith("SHARP")) {
          int colon = cmd.modelStr.indexOf(':');
          String sub = (colon >= 0) ? cmd.modelStr.substring(colon + 1) : "A907";
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
  preferences.clear(); // Hapus pengaturan lama di memori ESP32
  String ssid = preferences.getString("ssid", "Zanko 4G_plus");
  String password = preferences.getString("password", "Zanko050403");
  savedModel = preferences.getString("ac_model", "SHARP:A907");

  // Init IR
  acSharp.begin();
  acGree.begin();
  acMidea.begin();
  acSamsung.begin();

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
    setupTime();
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
    g_pir = digitalRead(PIN_PIR_SENSOR);

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
            Serial.printf("[Supabase] Terkirim dengan kode HTTP: %d\n", httpCode);
          }
        } else {
          Serial.printf("[Supabase] Gagal mengirim data, error: %s\n", http.errorToString(httpCode).c_str());
        }
        http.end();
      } else {
        Serial.println("[Supabase] Gagal membuat koneksi HTTP");
      }
    }
  }

  // Supabase Command Poller
  if (WiFi.status() == WL_CONNECTED && millis() - lastCmdTime >= CMD_INTERVAL) {
    lastCmdTime = millis();
    
    static WiFiClientSecure cmdClient;
    static bool isCmdClientSetup = false;
    if (!isCmdClientSetup) {
      cmdClient.setInsecure();
      isCmdClientSetup = true;
    }

    HTTPClient http;
    http.setReuse(true);
    // GET from Supabase where status=pending, order by created_at asc, limit 1
    String url = String(supabase_cmd_url) + "?select=*&status=eq.pending&order=created_at.asc&limit=1";
    if (http.begin(cmdClient, url)) {
      http.addHeader("apikey", supabase_key);
      http.addHeader("Authorization", String("Bearer ") + supabase_key);
      
      int httpCode = http.GET();
      if (httpCode > 0) {
        if (httpCode == 200) {
          String payload = http.getString();
          if (payload != "[]" && payload.length() > 2) {
            JsonDocument doc;
            DeserializationError err = deserializeJson(doc, payload);
            if (!err && doc.size() > 0) {
              long cmdId = doc[0]["id"];
              String command = doc[0]["command"];
              String cmdPayload = doc[0]["payload"];
              
              Serial.printf("\n[Cloud Command] Menerima ID: %ld, CMD: %s, PAYLOAD: %s\n", cmdId, command.c_str(), cmdPayload.c_str());
              
              if (command == "AC_ON") {
                sendAutoOnFromModelString(cmdPayload);
              } else if (command == "AC_OFF") {
                sendAutoOffFromModelString(cmdPayload);
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
                  Serial.printf("[Cloud Command] JSON Payload Error: %s\n", perr.c_str());
                }
              }
              
              // Tandai sebagai dieksekusi (PATCH)
              HTTPClient patchHttp;
              patchHttp.setReuse(true);
              String patchUrl = String(supabase_cmd_url) + "?id=eq." + String(cmdId);
              if (patchHttp.begin(cmdClient, patchUrl)) {
                patchHttp.addHeader("apikey", supabase_key);
                patchHttp.addHeader("Authorization", String("Bearer ") + supabase_key);
                patchHttp.addHeader("Content-Type", "application/json");
                // PATCH requests need Prefer: return=minimal for Supabase if we don't need body back
                patchHttp.addHeader("Prefer", "return=minimal");
                
                int pCode = patchHttp.PATCH("{\"status\":\"executed\"}");
                if (pCode == 204 || pCode == 200) {
                  Serial.println("[Cloud Command] Status berhasil diubah ke 'executed'");
                } else {
                  Serial.printf("[Cloud Command] Gagal PATCH status, HTTP: %d\n", pCode);
                }
                patchHttp.end();
              }
            }
          }
        }
      } else {
        Serial.printf("[Cloud Command] Gagal GET, error: %s\n", http.errorToString(httpCode).c_str());
      }
      http.end();
    }
  }
}