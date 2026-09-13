with open("/home/athira/WTF/frontend/backend/src/services/hardware/serial_provider.py", "r") as f:
    c = f.read()
if "class SerialCrankProvider" not in c:
    header = "from .base import CrankInputProvider\nclass SerialCrankProvider(CrankInputProvider):\n    pass\n\n"
    with open("/home/athira/WTF/frontend/backend/src/services/hardware/serial_provider.py", "w") as f:
        f.write(header + c)
