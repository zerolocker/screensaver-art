import os
import subprocess
import time
import json
import shutil
from datetime import datetime

STYLES = [
    {
        "style": "Scythian Goldwork",
        "image_prompt": "A highly detailed ancient Scythian Goldwork artifact, depicting dynamic animal style combat between a stag and a panther, glittering gold texture, 4th century BC.",
        "video_prompt": "The glittering gold surface subtly catches the light as the stylized animals seem to shift and writhe, ancient Scythian Goldwork brought to life.",
        "filename": "scythian_goldwork"
    },
    {
        "style": "Fayum Mummy Portraits",
        "image_prompt": "A highly detailed and naturalistic Fayum Mummy Portrait of a young person on a wooden panel, encaustic wax painting, expressive eyes, Roman Egypt era.",
        "video_prompt": "The candlelight subtly shifts across the textured encaustic wax surface, the eyes of the portrait seem to follow the viewer, Roman Egypt style.",
        "filename": "fayum_portrait"
    },
    {
        "style": "Jomon Pottery",
        "image_prompt": "An intricate ancient Japanese Jomon Pottery vessel, flame-like rims, elaborate cord-marked patterns, rough clay texture, prehistoric period.",
        "video_prompt": "Flickering firelight casts dancing shadows over the intricate cord-marked patterns and flame-like rims of the ancient Jomon pottery vessel.",
        "filename": "jomon_pottery"
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
