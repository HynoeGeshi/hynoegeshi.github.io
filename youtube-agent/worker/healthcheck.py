import os
import shutil
import sys
from dotenv import load_dotenv

load_dotenv()
checks = {
    'python': sys.version.split()[0],
    'ffmpeg': shutil.which(os.getenv('FFMPEG_BIN', 'ffmpeg')),
    'ffprobe': shutil.which(os.getenv('FFPROBE_BIN', 'ffprobe')),
    'supabase_url': bool(os.getenv('SUPABASE_URL')),
    'publishable_key': bool(os.getenv('SUPABASE_PUBLISHABLE_KEY')),
    'agent_email': bool(os.getenv('HYN_AGENT_EMAIL')),
    'agent_password': bool(os.getenv('HYN_AGENT_PASSWORD')),
}
for k, v in checks.items():
    print(f'{k}: {v}')
missing = [k for k,v in checks.items() if not v]
if missing:
    print('Missing:', ', '.join(missing))
    raise SystemExit(1)
print('Local worker prerequisites look ready.')
