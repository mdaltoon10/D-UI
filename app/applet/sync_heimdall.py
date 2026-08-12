import os
import shutil
import re

SOURCE_DIR = "/tmp/heimdall"
TARGET_DIR = "."

OLD_IMPORT = "github.com/mhsanaei/3x-ui/v3"
NEW_IMPORT = "github.com/mdaltoon10/D-UI/v3"

def process_file(file_path):
    if not file_path.endswith('.go'):
        return
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    if OLD_IMPORT in content:
        new_content = content.replace(OLD_IMPORT, NEW_IMPORT)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

def sync_directories():
    # 1. Sync internal/
    src_internal = os.path.join(SOURCE_DIR, "internal")
    dst_internal = os.path.join(TARGET_DIR, "internal")
    
    print("Syncing internal/...")
    for root, dirs, files in os.walk(src_internal):
        rel_path = os.path.relpath(root, src_internal)
        target_root = os.path.join(dst_internal, rel_path)
        os.makedirs(target_root, exist_ok=True)
        for file in files:
            src_file = os.path.join(root, file)
            dst_file = os.path.join(target_root, file)
            shutil.copy2(src_file, dst_file)
            process_file(dst_file)

    # 2. Sync frontend/src/
    src_frontend = os.path.join(SOURCE_DIR, "frontend", "src")
    dst_frontend = os.path.join(TARGET_DIR, "frontend", "src")
    
    print("Syncing frontend/src/...")
    for root, dirs, files in os.walk(src_frontend):
        rel_path = os.path.relpath(root, src_frontend)
        target_root = os.path.join(dst_frontend, rel_path)
        os.makedirs(target_root, exist_ok=True)
        for file in files:
            src_file = os.path.join(root, file)
            dst_file = os.path.join(target_root, file)
            shutil.copy2(src_file, dst_file)

    print("Sync complete!")

if __name__ == '__main__':
    sync_directories()
