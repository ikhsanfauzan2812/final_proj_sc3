import re

with open(r'c:\Users\Ikhsan\Documents\TA_v1\src\main.cpp', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove DaikinModel enum and all the daikin convert functions, queue, and irTask
pattern = re.compile(r'enum DaikinModel \{.*?\nvoid irTask\(void \*pv\) \{.*?vTaskDelete\(NULL\);\n\}\n', re.DOTALL)
code = pattern.sub('', code)

# 2. Rewrite sendAutoOnFromModelString
on_pattern = re.compile(r'void sendAutoOnFromModelString\(const String &modelStr\) \{.*?\}\n(?=\nvoid sendAutoOffFromModelString)', re.DOTALL)
new_on = """void sendAutoOnFromModelString(const String &modelStr) {
  Serial.printf("SEND ON -> model=%s\\n", modelStr.c_str());
  if (modelStr.startsWith("SHARP")) {
#if defined(SEND_SHARP_AC)
    int colon = modelStr.indexOf(':');
    String sub = (colon >= 0) ? modelStr.substring(colon + 1) : "A907";
    acSharp.setModel(sharpModelFromString(sub));
    acSharp.on();
    acSharp.setMode(kSharpAcCool);
    acSharp.setTemp(16);
    acSharp.setFan(kSharpAcFanHigh);
    acSharp.send();
#endif
  }
}
"""
code = on_pattern.sub(new_on, code)

# 3. Rewrite sendAutoOffFromModelString
off_pattern = re.compile(r'void sendAutoOffFromModelString\(const String &modelStr\) \{.*?\}\n(?=\n// ===)', re.DOTALL)
new_off = """void sendAutoOffFromModelString(const String &modelStr) {
  Serial.printf("SEND OFF -> model=%s\\n", modelStr.c_str());
  if (modelStr.startsWith("SHARP")) {
#if defined(SEND_SHARP_AC)
    acSharp.off();
    acSharp.send();
#endif
  }
}
"""
code = off_pattern.sub(new_off, code)

# 4. Remove all the other ac.begin()
begin_pattern = re.compile(r'  acDaikinESP\.begin\(\);\n.*?acBosch\.begin\(\);\n#endif\n', re.DOTALL)
code = begin_pattern.sub('', code)

# 5. Remove irQueue initialization
queue_pattern = re.compile(r'  irQueue = xQueueCreate.*?\}\n', re.DOTALL)
code = queue_pattern.sub('', code)

with open(r'c:\Users\Ikhsan\Documents\TA_v1\src\main.cpp', 'w', encoding='utf-8') as f:
    f.write(code)

print("Cleanup script done")
