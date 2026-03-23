import os
import subprocess
import time
import json
import shutil
from datetime import datetime

STYLES = [
    {
        "style": "Moche Ceramics",
        "image_prompt": "A highly detailed ancient Peruvian Moche portrait vessel, intricate fine line painting, naturalistic human face, terracotta clay texture, pre-Columbian era.",
        "video_prompt": "The terracotta surface subtly catches the light as the intricate fine line painting seems to shift, bringing the ancient Moche portrait to life.",
        "filename": "moche_ceramics"
    },
    {
        "style": "Olmec Colossal Heads",
        "image_prompt": "A highly detailed Olmec Colossal Head, carved basalt stone, realistic facial features, wearing a helmet, ancient Mesoamerican jungle setting.",
        "video_prompt": "Dappled jungle light plays across the textured basalt surface of the Olmec Colossal Head as it stands timelessly.",
        "filename": "olmec_head"
    },
    {
        "style": "Fatimid Rock Crystal Carving",
        "image_prompt": "An intricate medieval Fatimid rock crystal ewer, carved with birds and arabesques, highly transparent and gleaming, Islamic art.",
        "video_prompt": "Light refracts and sparkles through the transparent rock crystal ewer, illuminating the delicately carved birds and arabesques.",
        "filename": "fatimid_crystal"
    }
]

def run_with_retries(command, max_retries=5, delay=10):
    for i in range(max_retries):
        try:
            print(f"Running: {' '.join(command)}")
            result = subprocess.run(command, check=True, capture_output=True, text=True)
            print(f"Success: {result.stdout}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Attempt {i+1}/{max_retries} failed: {e.stderr}")
            time.sleep(delay)
    return False

def update_gallery(new_items):
    with open('gallery.json', 'r') as f:
        gallery = json.load(f)
    gallery = new_items + gallery
    with open('gallery.json', 'w') as f:
        json.dump(gallery, f, indent=4)

def append_styles(styles):
    with open('ART_STYLES_FOR_INSPIRATION.txt', 'a') as f:
        for s in styles:
            f.write(f"\n{s}")

def main():
    new_gallery_items = []
    new_styles = []
    
    for item in STYLES:
        img_file = f"gallery/{item['filename']}.png"
        vid_file = f"gallery/{item['filename']}_animated.mp4"
        
        # 1. Generate Image
        img_cmd = [
            "uv", "run", "/usr/local/lib/node_modules/openclaw/skills/nano-banana-pro/scripts/generate_image.py",
            "--prompt", item["image_prompt"],
            "--filename", img_file,
            "--aspect-ratio", "16:9"
        ]
        if not run_with_retries(img_cmd):
            print(f"Skipping {item['style']} due to image generation failure.")
            continue
            
        # 2. Generate Video
        vid_cmd = [
            "uv", "run", "/Users/jx/.openclaw/workspace/skills/veo3-video-gen/scripts/generate_video.py",
            "--prompt", item["video_prompt"],
            "--filename", vid_file,
            "--model", "veo-3.1-generate-preview",
            "--aspect-ratio", "16:9",
            "--reference-image", img_file,
            "--poll-seconds", "10"
        ]
        if not run_with_retries(vid_cmd):
            print(f"Skipping {item['style']} due to video generation failure.")
            continue
            
        # 3. Upload to R2
        upload_cmd = [
            "wrangler", "r2", "object", "put", f"screensaver-assets/{vid_file}",
            f"--file={vid_file}", "--remote"
        ]
        if run_with_retries(upload_cmd):
            # 4. Clean up
            os.remove(img_file)
            os.remove(vid_file)
            
            # 5. Add to gallery
            new_gallery_items.append({
                "src": f"https://pub-8430c52b593f42949119e2f7df4d5452.r2.dev/{vid_file}",
                "title": f"New Artwork - {item['style']} (AI Animated)",
                "type": "video",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "image_prompt": item["image_prompt"],
                "video_prompt": item["video_prompt"]
            })
            new_styles.append(item['style'])
            
    if new_gallery_items:
        update_gallery(new_gallery_items)
        append_styles(new_styles)
        
        # Git commit
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", f"AUTO_CURATION: Added {new_styles} collections"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("Done!")

if __name__ == "__main__":
    main()
