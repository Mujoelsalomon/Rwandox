import os, traceback
os.chdir(os.path.dirname(__file__))
try:
    import importlib
    importlib.invalidate_caches()
    import app
    print('Imported app successfully')
except Exception:
    traceback.print_exc()
