#!/usr/bin/env python3
"""Render approved mischievous 3D-style bunny as voiced, audio-reactive H.264 MP4.
The artwork is hand-animated in 2.5D from an approved image: no SVG or GIF.
"""
import json, math, subprocess
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

FPS=18
OUT=520
ASSET=Path('public/video/nibbles-reference.webp')

def audio_level(path):
    pcm=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ac','1','-ar','16000','-f','f32le','-'])
    samples=np.frombuffer(pcm,dtype='<f4')
    if len(samples)<500: raise RuntimeError('Audio is empty: '+str(path))
    size=800
    env=np.array([math.sqrt(float(np.mean(chunk**2)))
                  for chunk in (samples[i:i+size] for i in range(0,len(samples),size))
                  if len(chunk)>0],dtype=np.float32)
    threshold=max(float(np.percentile(env,90)),.004)
    return env,len(samples)/16000,threshold

def gain(env,threshold,t):
    at=min(len(env)-1,int(t*20))
    avg=float(np.mean(env[max(0,at-1):min(len(env),at+2)]))
    x=max(0.,min(1.,(avg/threshold-.07)/.8))
    return x*x*(3-2*x)

def base():
    img=Image.open(ASSET).convert('RGB')
    img=img.resize((400,469),Image.Resampling.LANCZOS)
    return np.asarray(img,dtype=np.uint8)

def animated_frame(img,t,strength,name):
    """Mouth aperture follows the real Qwen waveform, with independent acting."""
    height,width=img.shape[:2]
    yy,xx=np.mgrid[:height,:width].astype('float32')
    mx=xx.copy();my=yy.copy()
    def gaussian(cx,cy,rx,ry):
        return np.exp(-((xx-cx)/rx)**2-((yy-cy)/ry)**2*1.4).astype('float32')
    ear_l=gaussian(106,60,72,107)
    ear_r=gaussian(310,55,56,100)
    mx+=ear_l*(4.2*math.sin(t*2.6+.5))+ear_r*(5.4*math.sin(t*2.1+1.8))
    my+=ear_l*(2.5*math.sin(t*1.9))+ear_r*(4.0*math.sin(t*2.4+.7))
    head=gaussian(295,221,136,135)
    my+=head*(2.1*math.sin(t*3.1)+1.6*strength)
    mx+=head*(1.5*math.sin(t*1.45)-1.5*strength)
    brow=gaussian(278,152,104,46)
    my-=brow*(1.9*math.sin(t*2.6)+2.1*strength)
    # The actual mouth pixels open and close, rather than an unrelated loop.
    mouth=gaussian(311,245,43,30)
    aperture=.34+.98*strength
    my+=mouth*((yy-245)/aperture-(yy-245))
    mx+=mouth*((xx-311)/(.92+.08*strength)-(xx-311))
    cheer=1 if name in ('success','yes') else 0
    paw=gaussian(319,339,69,66)
    other=gaussian(242,334,65,67)
    mx+=paw*(-8*math.sin(t*5.1)-5*strength)+other*(4.4*math.sin(t*4.4+.8))
    my+=paw*(8*math.sin(t*3.7)+4*strength)+other*(5*math.sin(t*3.2+2))
    warped=cv2.remap(img,mx,my,interpolation=cv2.INTER_CUBIC,
                     borderMode=cv2.BORDER_REFLECT_101)
    theta=1.8*math.sin(t*1.27)+(4 if cheer else 0)*math.sin(t*4.1)
    matr=cv2.getRotationMatrix2D((260,280),theta,1.0)
    matr[0,2]+=1.5*math.sin(t*1.7)
    matr[1,2]+=-(4 if cheer else 1)*abs(math.sin(t*5))
    warped=cv2.warpAffine(warped,matr,(width,height),flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REFLECT_101)
    out=np.empty((OUT,OUT,3),dtype=np.uint8)
    top=np.array([231,240,251]);bot=np.array([251,253,255])
    grad=np.linspace(0,1,OUT).reshape(OUT,1,1)
    out[:,:,:]=((1-grad)*top+grad*bot).astype('uint8')
    canvas=Image.fromarray(out)
    layer=Image.fromarray(warped)
    edge=25
    ramp=np.minimum.reduce([
        np.arange(width)[None,:].repeat(height,0),
        np.arange(width)[::-1][None,:].repeat(height,0),
        np.arange(height)[:,None].repeat(width,1),
        np.arange(height)[::-1][:,None].repeat(width,1)])/edge
    mask=np.clip(ramp*255,0,255).astype('uint8')
    canvas.paste(layer,(60,23),Image.fromarray(mask))
    return np.asarray(canvas,dtype=np.uint8)

def render_file(name,sound,output,portrait):
    env,dur,norm=audio_level(sound)
    count=math.ceil((dur+.05)*FPS)
    cmd=['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-y',
         '-f','rawvideo','-pixel_format','rgb24','-video_size',f'{OUT}x{OUT}',
         '-framerate',str(FPS),'-i','pipe:0','-i',str(sound),
         '-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','veryfast',
         '-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k',
         '-movflags','+faststart','-shortest',str(output)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(count):
            proc.stdin.write(animated_frame(portrait,i/FPS,gain(env,norm,i/FPS),name).tobytes())
    finally:proc.stdin.close()
    if proc.wait()!=0 or output.stat().st_size<8000:raise RuntimeError('MP4 failed: '+name)
    print(name,'frames=',count,'bytes=',output.stat().st_size,flush=True)

def idle_movie(portrait,output):
    cmd=['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-y',
         '-f','rawvideo','-pixel_format','rgb24','-video_size',f'{OUT}x{OUT}',
         '-framerate',str(FPS),'-i','pipe:0','-an','-c:v','libx264',
         '-preset','veryfast','-crf','26','-pix_fmt','yuv420p',
         '-movflags','+faststart',str(output)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(5*FPS):
            proc.stdin.write(animated_frame(portrait,i/FPS,0,'idle').tobytes())
    finally:proc.stdin.close()
    if proc.wait()!=0 or output.stat().st_size<8000:raise RuntimeError('Idle film failed')

def main():
    manifest=json.loads(Path('public/audio/manifest.json').read_text())
    clips=manifest['clips']
    if manifest.get('engine')!='Qwen3-TTS-12Hz-1.7B-CustomVoice' or len(clips)!=16:
        raise RuntimeError('All 16 Qwen3 voice clips are required')
    target=Path('public/video');target.mkdir(parents=True,exist_ok=True)
    portrait=base()
    Image.fromarray(animated_frame(portrait,0,.15,'intro')).save(target/'poster.png')
    idle_movie(portrait,target/'idle.mp4')
    output={'version':1,'character':'Nibbles','art':'approved mischievous 3D bunny',
            'source':'Qwen3-TTS','codec':'H.264/AAC','clips':{}}
    for key,path in clips.items():
        name=target/(key+'.mp4')
        render_file(key,Path('public'+path),name,portrait)
        output['clips'][key]='/video/'+key+'.mp4'
    (target/'manifest.json').write_text(json.dumps(output,indent=2)+'\n')
    print('Nibbles movie complete:',len(output['clips']),'voiced scenes',flush=True)
if __name__=='__main__':main()
