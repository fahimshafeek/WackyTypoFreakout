from machine import I2C, Pin
from max30102 import MAX30102
import max30102
import time

i2c = I2C(scl=Pin(5), sda=Pin(4))
sensor = MAX30102(i2c=i2c)
sensor.setup_sensor()
sensor.set_sample_rate(400)
sensor.set_fifo_average(8)
sensor.set_active_leds_amplitude(max30102.MAX30105_PULSE_AMP_MEDIUM)

for _ in range(20):
    sensor.check()
    if sensor.available():
        ir = sensor.pop_ir_from_storage()
        print("IR value:", ir)
    time.sleep(0.1)
