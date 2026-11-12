(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const API='/.netlify/functions/owner';
  let state=null, editId=null, extraQuestions=[];
  const defaults={
    screens:{
      ask:['{name}, would you like to go out with {sender}?','That’s the whole big, very important question. What do you think?','Ehhh... Alex has a question for ya. He sent a rabbit. Bold choice, huh?'],
      outing:['What would you enjoy doing?','Pick an idea that actually sounds fun to you.','Here is the fun part. Coffee, wandering, food or sweets? I did not even put carrot farming on the list.'],
      area:['Where would be convenient?','No need to pick a specific place yet.','Somewhere comfortable for you, of course. My hop-mobile has a very limited range.'],
      schedule:['Which day works for you?','Pick a day from the calendar and a time of day, or decide together later.','Aha! The calendar! Pick a day that works for you. This rabbit does not do surprise alarms.'],
      success:['Bunny is doing happy little jumps!','You said yes to going out with Alex. I think this deserves a tiny celebration.','Well, would ya look at that! Mission accomplished! I knew this bow tie had magical powers!'],
      decline:['Absolutely no worries.','Thank you for answering. You’re lovely, and this bunny wishes you a wonderful day.','Hey, no worries! Thanks for being straight with me. Here’s a little flower, on the house.']
    },
    outings:{coffee:'Coffee or tea',walk:'A walk and exploring',food:'A bite to eat',sweet:'Something sweet',surprise:'A little surprise'},
    details:{
      coffee:['What kind of coffee stop?',['A cosy café and a good chat','Takeaway coffee and a stroll','Tea or a different drink','You two can choose']],
      walk:['Where should we wander?',['A park and some nature','Exploring the city','Somewhere by the water','You two can choose']],
      food:['What food sounds good?',['Italian','Asian food','Street food or casual bites','You two can choose']],
      sweet:['Which sweet treat?',['Bakery or pastries','Ice cream or gelato','Waffles or pancakes','You two can choose']],
      surprise:['What should the surprise feel like?',['Calm and cosy','Playful and fun','Outside and exploring','Alex can come up with something']]
    },
    areas:['Somewhere near me','Somewhere near Alex','Meet halfway','Choose a place together']
  };
  function elt(tag,text,className){
    const v=document.createElement(tag);if(text!==undefined&&text!==null)v.textContent=String(text);if(className)v.className=className;return v;
  }
  function labelInput(label,value,placeholder,kind='input',max=180) {
    const outer=elt('div',null,'field'), title=elt('label',label);
    const input=elt(kind);
    if(kind==='input')input.type='text';
    input.value=value||'';input.placeholder=placeholder||'';input.maxLength=max;
    title.append(input);outer.append(title);
    return {outer,input};
  }
  async function api(action,method='GET',body){
    const hdr={'Accept':'application/json'};
    if(method!=='GET'){hdr['Content-Type']='application/json';if(state?.csrf)hdr['X-Bunny-CSRF']=state.csrf;}
    const res=await fetch(API+'?action='+encodeURIComponent(action),{
      method,credentials:'same-origin',cache:'no-store',headers:hdr,
      ...(method!=='GET'?{body:JSON.stringify(body||{})}:{})
    });
    const data=await res.json().catch(()=>({error:'Invalid server response'}));
    if(!res.ok)throw new Error(data.error||'Request failed');
    return data;
  }
  function notice(message,error=false) {
    const node=$('status');node.textContent=message;node.hidden=false;
    node.style.background=error?'#a33355':'#2d2937';
  }
  function loggedOut(){
    state=null;$('dashboard').hidden=true;$('login').hidden=false;$('logout').hidden=true;
    $('password').value='';
  }
  async function refresh(){
    try{
      state=await api('state');$('dashboard').hidden=false;$('login').hidden=true;$('logout').hidden=false;
      extraQuestions=Array.isArray(state.settings.extraQuestions)?state.settings.extraQuestions.map(x=>({...x,options:[...x.options]})):[];
      renderInvites();renderSettings();
    }catch{loggedOut();}
  }
  $('login-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;$('login-error').textContent='';
    try{
      await api('login','POST',{email:$('email').value,password:$('password').value});
      await refresh();notice('Welcome back! Your Bunny Studio is ready.');
    }catch(error){$('login-error').textContent=error.message;}finally{button.disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{
    try{await api('logout','POST');}catch{/* still lock local UI */}loggedOut();notice('Signed out.');
  });
  function renderInvites(){
    const region=$('invites');region.replaceChildren();
    if(!state.invites.length)region.append(elt('p','No active invitations. Create one to start.'));
    state.invites.forEach(inv=>{
      const row=elt('div',null,'invite');
      const left=elt('div');
      left.append(elt('h3',inv.name));
      left.append(elt('div',inv.id+' · '+(inv.enabled?'Active':'Paused'),'muted'));
      const edit=elt('button','Edit','btn');edit.type='button';edit.addEventListener('click',()=>openInvite(inv));
      const remove=elt('button','Delete','btn danger');remove.type='button';
      remove.addEventListener('click',async()=>{
        if(!confirm('Delete invitation for '+inv.name+'? This invalidates its password.'))return;
        try{const data=await api('delete','POST',{id:inv.id});state.invites=data.invites;renderInvites();notice('Invitation deleted.');}
        catch(error){notice(error.message,true);}
      });
      const tools=elt('div',null,'row');tools.append(edit,remove);
      const top=elt('div',null,'row between');top.append(left,tools);row.append(top);region.append(row);
    });
  }
  function openInvite(inv=null){
    editId=inv?.id||null;$('invite-editor').hidden=false;
    $('invite-editor-title').textContent=inv?'Edit invitation':'New invitation';
    $('invite-name').value=inv?.name||'';$('invite-id').value=inv?.id||'';
    $('invite-id').readOnly=Boolean(inv);$('invite-enabled').checked=inv?.enabled!==false;
    $('invite-password').value='';$('invite-name').focus();
    $('invite-editor').scrollIntoView({block:'nearest',behavior:'smooth'});
  }
  $('new-invite').addEventListener('click',()=>openInvite());
  $('cancel-invite').addEventListener('click',()=>{$('invite-editor').hidden=true;$('invite-password').value='';});
  $('generate-invite-password').addEventListener('click',()=>{
    if(!crypto?.getRandomValues){notice('Secure password generation is not available.',true);return;}
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes=new Uint8Array(20);crypto.getRandomValues(bytes);
    $('invite-password').value=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
    $('invite-password').select();
    notice('Password generated. Copy it somewhere private before saving.');
  });
  $('invite-form').addEventListener('submit',async e=>{
    e.preventDefault();const save=e.submitter;save.disabled=true;
    const body={id:$('invite-id').value.trim(),name:$('invite-name').value.trim(),password:$('invite-password').value.trim(),enabled:$('invite-enabled').checked};
    try{
      const result=await api('invite','POST',{invite:body});
      state.invites=result.invites;renderInvites();
      $('invite-editor').hidden=true;$('invite-password').value='';
      notice('Invitation saved. Use the password you generated or entered; it cannot be retrieved afterward.');
    }catch(error){notice(error.message,true);}finally{save.disabled=false;}
  });
  function renderSettings(){
    const config=state.settings||{};
    $('sender-name').value=config.senderName||'Alex';
    $('site-label').value=config.siteLabel||'tiny bunny mission';
    const screens=$('screen-fields');screens.replaceChildren();
    for(const [key,values] of Object.entries(defaults.screens)){
      const box=elt('div',null,'question');box.append(elt('h3',key.charAt(0).toUpperCase()+key.slice(1)));
      const grid=elt('div',null,'grid');
      for(const [index,field] of ['heading','subheading','speech'].entries()){
        const pair=labelInput(field==='speech'?'What Bunny says':field==='heading'?'Question/title':'Description',
          config.screens?.[key]?.[field]||'',values[index],field==='speech'?'textarea':'input',field==='speech'?500:180);
        pair.input.dataset.screen=key;pair.input.dataset.field=field;
        if(field==='speech')pair.outer.classList.add('full');
        grid.append(pair.outer);
      }
      box.append(grid);screens.append(box);
    }
    const outings=$('outing-fields');outings.replaceChildren();
    Object.entries(defaults.outings).forEach(([key,value])=>{
      const pair=labelInput(key,config.outingLabels?.[key]||'',value,'input',75);
      pair.input.dataset.outing=key;outings.append(pair.outer);
    });
    const details=$('detail-fields');details.replaceChildren();
    for(const [key,[heading,options]] of Object.entries(defaults.details)){
      const wrapper=elt('div',null,'question');wrapper.append(elt('h3',key));
      const inputs=elt('div',null,'grid');
      const h=labelInput('Follow-up question',config.detail?.[key]?.heading||'',heading,'input',180);
      h.input.dataset.detail=key;h.input.dataset.field='heading';
      const speech=labelInput('Bunny line (optional)',config.detail?.[key]?.speech||'','Keep original narration','textarea',500);
      speech.input.dataset.detail=key;speech.input.dataset.field='speech';
      const opts=labelInput('Four choices (one per line)',
        (config.detail?.[key]?.options?.some(Boolean)?config.detail[key].options:options).join('\n'),
        options.join(' / '),'textarea',600);
      opts.input.dataset.detail=key;opts.input.dataset.field='options';
      opts.outer.classList.add('full');speech.outer.classList.add('full');
      inputs.append(h.outer,speech.outer,opts.outer);wrapper.append(inputs);details.append(wrapper);
    }
    const areas=$('area-fields');areas.replaceChildren();
    defaults.areas.forEach((value,index)=>{
      const pair=labelInput('Area choice '+(index+1),config.areaLabels?.[index]||'',value,'input',85);
      pair.input.dataset.area=String(index);areas.append(pair.outer);
    });
    renderExtra();
  }
  function renderExtra(){
    const list=$('extra-questions');list.replaceChildren();
    extraQuestions.forEach((q,index)=>{
      const box=elt('div',null,'question');
      const top=elt('div',null,'row between');top.append(elt('h3','Extra question '+(index+1)));
      const del=elt('button','Remove','btn danger');del.type='button';
      del.addEventListener('click',()=>{extraQuestions.splice(index,1);renderExtra();});
      top.append(del);box.append(top);
      const title=labelInput('Question',q.heading,'e.g. What music do you love?','input',140);
      title.input.addEventListener('input',()=>{q.heading=title.input.value;});
      const speech=labelInput('Bunny commentary',q.speech,'Optional funny line','textarea',400);
      speech.input.addEventListener('input',()=>{q.speech=speech.input.value;});
      const options=labelInput('Choices, one per line',q.options.join('\n'),'Option one\nOption two','textarea',600);
      options.input.addEventListener('input',()=>{q.options=options.input.value.split('\n').map(x=>x.trim()).filter(Boolean);});
      box.append(title.outer,speech.outer,options.outer);list.append(box);
    });
  }
  $('add-question').addEventListener('click',()=>{
    if(extraQuestions.length>=5){notice('Maximum five extra questions.',true);return;}
    extraQuestions.push({id:'extra-'+extraQuestions.length,heading:'',speech:'',options:['','']});renderExtra();
  });
  $('settings-form').addEventListener('submit',async e=>{
    e.preventDefault();const save=e.submitter;save.disabled=true;
    const settings={senderName:$('sender-name').value,siteLabel:$('site-label').value,screens:{},outingLabels:{},detail:{},areaLabels:[],extraQuestions};
    document.querySelectorAll('[data-screen]').forEach(x=>{
      if(!settings.screens[x.dataset.screen])settings.screens[x.dataset.screen]={};
      settings.screens[x.dataset.screen][x.dataset.field]=x.value;
    });
    document.querySelectorAll('[data-outing]').forEach(x=>{settings.outingLabels[x.dataset.outing]=x.value;});
    document.querySelectorAll('[data-detail]').forEach(x=>{
      if(!settings.detail[x.dataset.detail])settings.detail[x.dataset.detail]={};
      settings.detail[x.dataset.detail][x.dataset.field]=x.dataset.field==='options'?x.value.split('\n').map(y=>y.trim()):x.value;
    });
    document.querySelectorAll('[data-area]').forEach(x=>{settings.areaLabels[Number(x.dataset.area)]=x.value;});
    try{
      const result=await api('save','POST',{settings});
      state.settings=result.settings;notice('Saved. Refresh the visitor page to see the updated invitation.');
      renderSettings();
    }catch(error){notice(error.message,true);}finally{save.disabled=false;}
  });
  $('owner-password-form').addEventListener('submit',async e=>{
    e.preventDefault();const save=e.submitter;save.disabled=true;
    try{
      await api('password','POST',{currentPassword:$('old-owner-password').value,newPassword:$('new-owner-password').value});
      e.currentTarget.reset();loggedOut();notice('Owner password updated. Sign in with the new password.');
    }catch(error){notice(error.message,true);}finally{save.disabled=false;}
  });
  refresh();
})();
