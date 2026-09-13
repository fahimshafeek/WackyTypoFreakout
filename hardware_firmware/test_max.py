import machine
import max30102
print(dir(max30102))
try:
    print(dir(max30102.MAX30102))
except Exception as e:
    print(e)
