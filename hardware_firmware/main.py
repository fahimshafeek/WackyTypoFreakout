import machine
import time
from machine import I2C, Pin
from max30102 import MAX30102
import max30102

HOLE_THRESHOLD = 3000
CARDBOARD_THRESHOLD = 6000

def main():
    print("Initializing Crank Hardware (Max Polling Mode)...")

    i2c = I2C(scl=Pin(5), sda=Pin(4))
    sensor = MAX30102(i2c=i2c)
    
    if not sensor.check_part_id():
        print("Warning: MAX30102 sensor not found or wrong part ID.")
    
    sensor.setup_sensor()
    sensor.set_sample_rate(400)
    sensor.set_fifo_average(1)
    sensor.set_active_leds_amplitude(max30102.MAX30105_PULSE_AMP_MEDIUM)
    
    print("Starting sensor reading loop...")
    
    in_hole = False
    
    while True:
        sensor.check()
        
        # Use if instead of while to prevent infinite loop if FIFO ptr gets stuck
        if sensor.available():
            red = sensor.pop_red_from_storage() # MUST POP RED!
            ir = sensor.pop_ir_from_storage()
            
            if not in_hole and ir < HOLE_THRESHOLD:
                in_hole = True
                print("PULSE")
            elif in_hole and ir > CARDBOARD_THRESHOLD:
                in_hole = False
                
        time.sleep(0.005)

if __name__ == '__main__':
    main()
