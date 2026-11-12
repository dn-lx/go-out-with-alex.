#!/usr/bin/env python3
"""Audio-driven, hand-rigged frame-by-frame cartoon. Real H.264 MP4, not SVG/GIF."""
import argparse, json, math, subprocess
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

N=520
FPS=20
PINK=(238,133,161,255)
INK=(89,74,100,255)
GREY=(179,175,190,255)
GREY_DARK=(148,142,163,255)
MILK=(255,250,247,255)

def ease(x):
    x=max(0.,min(1.,x));return x*x*(3-2*x)
def pulse(t,a,b,r=.16):
    if not a-r<=t<=b+r:return 0.
    return ease((t-a+r)/(2*r))*(1-ease((t-b+r)/(2*r)))
def ellipse(d,box,fill,outline=None,width=2):d.ellipse(tuple(int(v) for v in box),fill=fill,outline=outline,width=width)
def line(d,xy,fill,width=2):d.line([(int(a),int(b)) for a,b in xy],fill=fill,width=width,joint='curve')
def polygon(d,xy,fill,outline=None,width=2):d.polygon(xy,fill=fill);d.line(list(xy)+[xy[0]],fill=outline or fill,width=width,joint='curve')

def audio_envelope(path):
    data=subprocess.check_output(['ffmpeg','-v','error','-i',str(path),'-ac','1','-ar','16000','-f','f32le','-'])
    signal=np.frombuffer(data,dtype='<f4')
    if signal.size<16000:return np.zeros(40),1.,.006
    count=math.ceil(len(signal)/800)
    env=np.array([np.sqrt(np.mean(np.square(signal[i*800:(i+1)*800]))) for i in range(count)])
    return env,len(signal)/16000,max(.006,float(np.percentile(env,92)))

def level_at(env,norm,t):
    ix=max(0,min(len(env)-1,int(t*20)))
    a=env[max(0,ix-1):min(len(env),ix+2)]
    return ease((float(np.mean(a))/norm-.07)/.68)

def bunny_frame(t,duration,name,voice=.45):
    bg=Image.new('RGBA',(N,N),(253,237,242,255));d=ImageDraw.Draw(bg)
    ellipse(d,(-105,-94,360,356),(255,250,239,255))
    ellipse(d,(270,-60,670,330),(248,226,244,255))
    ellipse(d,(-50,412,570,670),(218,235,211,255))
    ellipse(d,(100,447,416,477),(163,138,162,60))
    for i,(x,y) in enumerate([(43,156),(473,146),(65,380),(450,382),(380,61),(138,82)]):
        s=2+(i%2)
        line(d,[(x-s,y),(x+s,y)],(221,141,167,180),2)
        line(d,[(x,y-s),(x,y+s)],(221,141,167,180),2)
    talk=voice
    wow=pulse(t,.25,1.0) if name in ('intro','ask') else 0.
    flourish=pulse(t,max(.2,duration*.37),min(duration-.5,duration*.67))
    joyful=1 if name in ('success','yes') else 0
    shy=1 if name=='decline' else 0
    leftup=min(.8,max(.0,.24+flourish*.54+joyful*.36+talk*.12+wow*.15))
    rightup=min(.93,max(.0,.18+flourish*.43+joyful*.46+talk*.23))
    if shy:leftup=.22;rightup=.38
    dy=math.sin(t*2.6)*2.6+talk*2.5-joyful*abs(math.sin(t*6.3))*7
    ellipse(d,(134,294+dy,383,474+dy),(142,133,162,255),INK,4)
    ellipse(d,(159,320+dy,359,465+dy),GREY,INK,4)
    ellipse(d,(184,346+dy,337,461+dy),MILK)
    ellipse(d,(210,369+dy,310,453+dy),(246,236,235,255))
    ellipse(d,(151,437+dy,222,474+dy),GREY,INK,3)
    ellipse(d,(305,437+dy,374,474+dy),GREY,INK,3)
    ly=345+dy-leftup*85;ry=340+dy-rightup*80
    lx=131-leftup*21+math.sin(t*2)*3;rx=380+rightup*17+math.cos(t*2.3)*3
    line(d,[(175,348+dy),(145,380+dy),(lx,ly)],GREY_DARK,38)
    line(d,[(345,343+dy),(365,367+dy),(rx,ry)],GREY_DARK,38)
    ellipse(d,(lx-26,ly-24,lx+27,ly+25),MILK,INK,3)
    ellipse(d,(rx-27,ry-25,rx+27,ry+25),MILK,INK,3)
    for dx in (-10,0,10):
        line(d,[(lx+dx,ly-12),(lx+dx-2,ly-4)],(224,206,212,255),2)
        line(d,[(rx+dx,ry-12),(rx+dx-2,ry-4)],(224,206,212,255),2)
    head=Image.new('RGBA',(N,N),(0,0,0,0));h=ImageDraw.Draw(head)
    for cx,tilt in [(204,-7+math.sin(t*2.2)*8+talk*6),(318,9+math.cos(t*2.0)*10-talk*7)]:
        ear=Image.new('RGBA',(N,N),(0,0,0,0));e=ImageDraw.Draw(ear)
        ellipse(e,(cx-27,34,cx+27,198),GREY,INK,4)
        ellipse(e,(cx-15,50,cx+15,185),(246,167,191,255))
        ear=ear.rotate(tilt,resample=Image.Resampling.BICUBIC,center=(cx,180))
        head.alpha_composite(ear)
    h=ImageDraw.Draw(head)
    ellipse(h,(126,147,391,380),GREY,INK,5)
    ellipse(h,(138,158,382,354),(195,192,204,255))
    ellipse(h,(150,284,236,348),MILK)
    ellipse(h,(278,284,363,348),MILK)
    ellipse(h,(161,299,200,321),(255,186,196,190))
    ellipse(h,(323,299,359,321),(255,186,196,190))
    blink=(math.sin(2*math.pi*.36*t)+.97)>.995 or (math.sin(2*math.pi*.51*t)+.98)>.995
    for x in (213,309):
        if blink or (joyful and t<.8):
            h.arc((x-24,242,x+24,270),185,350,fill=INK,width=5)
        else:
            ellipse(h,(x-20,221,x+20,275),MILK,INK,3)
            ellipse(h,(x-10+math.sin(t*.8)*1.5,230,x+10+math.sin(t*.8)*1.5,263),(55,47,66,255))
            ellipse(h,(x-6,232,x-1,238),(255,255,255,255))
    line(h,[(192,217-talk*8),(218,211-talk*8),(231,219-talk*7)],INK,4)
    line(h,[(291,219-talk*7),(309,211-talk*8),(329,216-talk*8)],INK,4)
    ellipse(h,(223,287,300,333),MILK)
    for side in (-1,1):
        cx=259+side*57
        for yy,delta in [(298,-11),(311,1),(323,13)]:
            line(h,[(cx,yy),(cx+side*(53+abs(delta)),yy+delta)],(125,111,126,255),2)
    polygon(h,[(247,288),(268,288),(257,304)],PINK,(170,95,128,255),2)
    mw=13+voice*21+4*math.sin(t*9)**2
    mh=3+voice*33
    if voice<.11:h.arc((232,297,285,333),2,178,fill=INK,width=4)
    else:
        ellipse(h,(259-mw,307-mh*.12,259+mw,307+mh),(88,50,75,255),INK,3)
        if voice>.35:ellipse(h,(249,310+mh*.3,270,317+mh*.3),(239,119,159,255))
        if voice>.65:polygon(h,[(250,305),(269,305),(268,312),(250,312)],MILK)
    for cx,cy in [(220,300),(229,309),(298,300),(292,312)]:
        ellipse(h,(cx-2,cy-2,cx+2,cy+2),(134,105,124,255))
    head=head.rotate(math.sin(t*1.8)*3.7+talk*2.5+wow*3,
                     resample=Image.Resampling.BICUBIC,center=(259,294))
    bg.alpha_composite(head,(0,int(dy)))
    d=ImageDraw.Draw(bg)
    polygon(d,[(207,348+dy),(309,350+dy),(315,412+dy),(204,416+dy)],
            (248,151,177,255),(196,89,131,255),4)
    polygon(d,[(210,353+dy),(261,388+dy),(311,352+dy)],
            (255,197,212,255),(198,99,141,255),3)
    polygon(d,[(246,381+dy),(255,388+dy),(261,382+dy),(269,389+dy),(258,403+dy)],MILK)
    ellipse(d,(178,356+dy-leftup*14,235,401+dy-leftup*14),MILK,INK,3)
    ellipse(d,(290,356+dy-rightup*14,345,401+dy-rightup*14),MILK,INK,3)
    if joyful:
        for i in range(9):
            xx=60+(i*67)%410;yy=(t*52+i*93)%535-20
            ellipse(d,(xx,yy,xx+6,yy+10),PINK if i%2 else (163,187,135,255))
    if shy:ellipse(d,(390,322,404,338),(244,163,185,255))
    return bg.convert('RGB')

def render_clip(key,audio_path,out_path):
    env,duration,norm=audio_envelope(audio_path)
    duration+=.18;frames=math.ceil(duration*FPS)
    out_path.parent.mkdir(parents=True,exist_ok=True)
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',
         '-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24',
         '-s',str(N)+'x'+str(N),'-r',str(FPS),'-i','pipe:0',
         '-i',str(audio_path),'-map','0:v:0','-map','1:a:0',
         '-c:v','libx264','-preset','veryfast','-crf','24','-pix_fmt','yuv420p',
         '-c:a','aac','-b:a','96k','-movflags','+faststart','-shortest',str(out_path)]
    enc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(frames):
            t=i/FPS
            frame=bunny_frame(t,duration,key,level_at(env,norm,t))
            enc.stdin.write(frame.tobytes())
    finally:
        enc.stdin.close()
    if enc.wait()!=0 or not out_path.exists() or out_path.stat().st_size<15000:
        raise RuntimeError('Failed to render '+key)
    print('OK',key,frames,'frames',out_path.stat().st_size,'bytes',flush=True)

def render_idle(destination, seconds=5):
    """Quiet looping intro video, so the character moves even between lines."""
    frames=seconds*FPS
    cmd=['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',
         '-f','rawvideo','-vcodec','rawvideo','-pix_fmt','rgb24',
         '-s',str(N)+'x'+str(N),'-r',str(FPS),'-i','pipe:0',
         '-an','-c:v','libx264','-preset','veryfast','-crf','24',
         '-pix_fmt','yuv420p','-movflags','+faststart',str(destination)]
    enc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(frames):
            t=i/FPS
            enc.stdin.write(bunny_frame(t,seconds,'idle',0).tobytes())
    finally:
        enc.stdin.close()
    if enc.wait()!=0 or not destination.exists() or destination.stat().st_size<15000:
        raise RuntimeError('Failed to render idle video')
    print('OK idle',frames,'frames',destination.stat().st_size,'bytes',flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--single');args=parser.parse_args()
    manifest=json.loads(Path('public/audio/manifest.json').read_text())
    clips=manifest.get('clips',{})
    if manifest.get('engine')!='Qwen3-TTS-12Hz-1.7B-CustomVoice' or len(clips)!=16:
        raise RuntimeError('Expected the complete 16 Qwen3 audio clips')
    items=[(k,v) for k,v in clips.items() if not args.single or k==args.single]
    if not items:raise RuntimeError('No matching audio clips')
    folder=Path('public/video');folder.mkdir(parents=True,exist_ok=True)
    bunny_frame(0,5,'idle',0).save(folder/'poster.png')
    render_idle(folder/'idle.mp4')
    result={'version':1,'source':'Qwen3-TTS','codec':'H.264/AAC','clips':{}}
    for name,path in items:
        dest=folder/(name+'.mp4')
        render_clip(name,Path('public'+path),dest)
        result['clips'][name]='/video/'+name+'.mp4'
    if not args.single and len(result['clips'])==len(clips):
        (folder/'manifest.json').write_text(json.dumps(result,indent=2)+'\n')

if __name__=='__main__':main()
