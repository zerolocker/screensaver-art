# Living Art Screensaver Automated Curation

You are building a web-based screensaver app that showcases classic and modern artworks brought to life using AI animation (Google Veo 3.1). You are working on an automated task to curate a new art collection. All the files below are relative to the directory "screensaver/". 


## Steps to execute
- **Gain Context:** Load "README.md" into your context, so that you have a general understanding of what you are building. To gain more context, you are allowed to list and read the files in this directory -- feel free to explore.

- **Still Image Generation:** Use Gemini 3 Pro Image (Nano Banana Pro) to generate high-quality paintings. You should first think of an art theme or art style to generate. You can view the already generated images in `gallary/` to avoid generating the same style as what is already there. Also read "ART_STYLES_FOR_INSPIRATION.md" to see some art style examples to inspire you. 

- **AI Animation:** Use the `veo3-video-gen` skill to animate the generated images. Make sure all images are animated.

- Update "index.html" accordingly.

- Repeat the steps above 3 times to generate unique art pieces to vastly increase gallery variety.

- **Art Style Expansion:** Come up with, and add one or two more art styles to "ART_STYLES_FOR_INSPIRATION.md". If there're already more than 100 in that file, summarize it into around ~50 styles, keeping the most general ones.
