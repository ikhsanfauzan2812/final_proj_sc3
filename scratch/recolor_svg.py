import re

file_path = r"C:\Users\Ikhsan\Documents\TA_v1\dashboard\public\logo_bnw.svg"
with open(file_path, "r", encoding="utf-8") as f:
    data = f.read()

data = re.sub(r'fill="#[A-Fa-f0-9]{6}"', 'fill="#00f2fe"', data)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(data)
