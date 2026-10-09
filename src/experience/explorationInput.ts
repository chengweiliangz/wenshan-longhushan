/** Shared raft/explorer input. Pointer lock is requested only by an explicit click/API action. */
export type ExplorationInputController={setInput:(forward:number,right:number,fast:boolean)=>void;look:(yaw:number,pitch:number)=>void;clearInput?:()=>void};
export type ExplorationInputOptions={
 canvas:HTMLElement;controller:ExplorationInputController;canMove?:()=>boolean;canLook?:()=>boolean;
 getSensitivity?:()=>number;pointerLockOnCanvasClick?:boolean;
 onPointerLockChange?:(locked:boolean)=>void;onTap?:(clientX:number,clientY:number)=>void;
 document?:Document;window?:Window;
};
const axis=(v:number)=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
export function isExplorationTextInput(target:EventTarget|null){
 const e=target as HTMLElement|null;if(!e)return false;
 return /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName??'')||Boolean(e.isContentEditable)||Boolean(e.closest?.('[contenteditable="true"],[contenteditable=""]'));
}
export function attachExplorationInput(options:ExplorationInputOptions){
 const canvas=options.canvas,doc=options.document??canvas.ownerDocument,win=options.window??doc.defaultView??window,controller=options.controller;
 const keys=new Set<string>(),removers:(()=>void)[]=[];let ui={forward:0,right:0,fast:false},disposed=false,suppressClickUntil=0;
 let press:{id:number;x:number;y:number;lastX:number;lastY:number;touch:boolean;dragging:boolean}|null=null;
 const now=()=>win.performance?.now()??Date.now();
 const visible=()=>!doc.hidden&&doc.visibilityState!=='hidden';
 const canLook=()=>!disposed&&visible()&&!isExplorationTextInput(doc.activeElement)&&(options.canLook?.()??true);
 const canMove=()=>canLook()&&(options.canMove?.()??true);
 const sensitivity=()=>{const v=options.getSensitivity?.()??.0025;return Number.isFinite(v)?Math.max(.0001,Math.min(.03,v)):.0025;};
 const locked=()=>doc.pointerLockElement===canvas;
 const code=(e:KeyboardEvent)=>e.code||({w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',Shift:'ShiftLeft'} as Record<string,string>)[e.key]||e.key;
 const relevant=(c:string)=>['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(c);
 function stopController(){if(controller.clearInput)controller.clearInput();else controller.setInput(0,0,false);}
 function applyInput(){
  if(!canMove()){stopController();return;}
  const held=(a:string,b:string)=>keys.has(a)||keys.has(b);
  controller.setInput(axis(ui.forward+Number(held('KeyW','ArrowUp'))-Number(held('KeyS','ArrowDown'))),axis(ui.right+Number(held('KeyD','ArrowRight'))-Number(held('KeyA','ArrowLeft'))),ui.fast||keys.has('ShiftLeft')||keys.has('ShiftRight'));
 }
 function clearInput(){keys.clear();ui={forward:0,right:0,fast:false};press=null;stopController();}
 function releaseLock(){if(locked())doc.exitPointerLock?.();}
 function refreshEnabled(){
  if(!canLook()){clearInput();releaseLock();return;}
  if(!canMove()){keys.clear();ui={forward:0,right:0,fast:false};stopController();}
  else applyInput();
 }
 async function requestPointerLock():Promise<boolean>{
  if(!canLook()||!canvas.requestPointerLock)return false;
  try{await canvas.requestPointerLock();return locked();}catch{return false;}
 }
 function onKeyDown(e:KeyboardEvent){
  if(e.key==='Escape'||e.code==='Escape'){clearInput();releaseLock();return;}
  if(!canMove()||isExplorationTextInput(e.target)||isExplorationTextInput(doc.activeElement)||e.ctrlKey||e.metaKey||e.altKey)return;
  const c=code(e);if(!relevant(c))return;e.preventDefault();keys.add(c);applyInput();
 }
 function onKeyUp(e:KeyboardEvent){const c=code(e);if(!relevant(c))return;keys.delete(c);applyInput();if(canMove()&&!isExplorationTextInput(e.target))e.preventDefault();}
 function onFocus(e:FocusEvent){if(isExplorationTextInput(e.target)){clearInput();releaseLock();}}
 function onPointerDown(e:PointerEvent){
  refreshEnabled();if(!canLook()||locked()||press||e.pointerType!=='touch'&&e.button!==0)return;
  press={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,touch:e.pointerType==='touch',dragging:false};
  try{canvas.setPointerCapture?.(e.pointerId);}catch{/* Window move/up listeners retain the fallback drag. */}
 }
 function onPointerMove(e:PointerEvent){
  if(!canLook())return;
  if(locked()){controller.look(-(e.movementX||0)*sensitivity(),-(e.movementY||0)*sensitivity());return;}
  if(!press||press.id!==e.pointerId)return;
  const dx=e.clientX-press.x,dy=e.clientY-press.y;
  if(!press.dragging){
   if(Math.hypot(dx,dy)<6)return;
   if(press.touch&&!canMove()&&Math.abs(dy)>Math.abs(dx)){press=null;return;}
   press.dragging=true;
  }
  e.preventDefault();controller.look(-(e.clientX-press.lastX)*sensitivity(),-(e.clientY-press.lastY)*sensitivity());press.lastX=e.clientX;press.lastY=e.clientY;
 }
 function onPointerUp(e:PointerEvent){
  if(!press||press.id!==e.pointerId)return;const p=press;press=null;
  if(p.dragging||p.touch)suppressClickUntil=now()+350;
  if(!p.dragging&&canLook())options.onTap?.(e.clientX,e.clientY);
  try{canvas.releasePointerCapture?.(e.pointerId);}catch{/* Capture may already have ended. */}
 }
 function onPointerCancel(e:PointerEvent){if(press?.id===e.pointerId)press=null;}
 function onClick(){if(now()>=suppressClickUntil&&canLook()&&options.pointerLockOnCanvasClick!==false)void requestPointerLock();}
 function onWheel(e:WheelEvent){if(canMove())e.preventDefault();}
 function onLockChange(){clearInput();options.onPointerLockChange?.(locked());}
 function onBlur(){clearInput();releaseLock();}
 function onVisibility(){if(!visible()){clearInput();releaseLock();}}
 function listen(target:EventTarget,event:string,handler:EventListener,opts?:AddEventListenerOptions){
  target.addEventListener(event,handler,opts);removers.push(()=>target.removeEventListener(event,handler,opts));
 }
 listen(win,'keydown',onKeyDown as EventListener);listen(win,'keyup',onKeyUp as EventListener);listen(win,'blur',onBlur);
 listen(doc,'focusin',onFocus as EventListener);listen(doc,'visibilitychange',onVisibility);listen(doc,'pointerlockchange',onLockChange);
 listen(doc,'pointerlockerror',onLockChange);listen(canvas,'pointerdown',onPointerDown as EventListener);
 listen(win,'pointermove',onPointerMove as EventListener,{passive:false});listen(win,'pointerup',onPointerUp as EventListener);listen(win,'pointercancel',onPointerCancel as EventListener);
 listen(canvas,'click',onClick);listen(canvas,'wheel',onWheel as EventListener,{passive:false});
 refreshEnabled();
 return{requestPointerLock,clearInput,refreshEnabled,isPointerLocked:locked,
  setUIInput(forward:number,right:number,fast=false){ui={forward:axis(forward),right:axis(right),fast:Boolean(fast)};applyInput();},
  clearUIInput(){ui={forward:0,right:0,fast:false};applyInput();},
  dispose(){if(disposed)return;clearInput();for(const remove of removers)remove();disposed=true;releaseLock();},
 };
}
