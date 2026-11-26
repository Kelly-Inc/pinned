(self.modernJsonp=self.modernJsonp||[]).push([[57657],{598496(e,r,l){l.r(r);var o=l(768540),a=l(923119),i=l(417487),d=l(504400),n=l(430875),t=l(312954),s=l(516001),c=l(238429),b=l(550407),h=l(449440),p=l(924271);l(418631);var m=l(358169),u=l(493532);function y(){return(0,a.useEffect)(()=>{(0,o.A)("DevErrorModal","/pws/react/DevErrorModal.tsx")},[]),null}function f({errors:e,onDismiss:r}){(0,a.useEffect)(()=>{(0,o.A)("DevErrorModal","/pws/react/DevErrorModal.tsx")},[]);let l=e.filter(e=>(0,m.B)(e)),[y,g]=(0,a.useState)(0),[v]=l;if(!v)return null;let[A,Y]=l[y]?[l[y],y]:[v,0],{title:D,summary:E,details:w}="hydration"===A.type?{title:"Hydration Error",summary:{label:"Error",body:A.payload.error.message},details:{label:"Component Stack",body:A.payload.errorInfo.componentStack??"[No component stack available]"}}:{title:"Server Error",summary:{label:"Module Name",body:A.payload.moduleName},details:{label:"Error Message",body:A.payload.message}};return(0,u.Y)(i.A,{zIndex:h.nH,children:(0,u.FD)(d.A,{accessibilityModalLabel:"Dev error modal",align:"start",heading:(0,u.FD)(n.A,{display:"flex",justifyContent:"between",marginBottom:-10,children:[(0,u.Y)(t.A,{accessibilityLevel:1,size:"600",children:D}),l.length>1?(0,u.FD)(s.A,{alignItems:"center",children:[(0,u.Y)(c.A,{accessibilityLabel:"Previous error",disabled:0===Y,icon:"chevron-left",onClick:()=>g(Y-1)}),(0,u.FD)(b.A,{align:"center",children:[Y+1," of ",l.length," errors"]}),(0,u.Y)(c.A,{accessibilityLabel:"Next error",disabled:Y===l.length-1,icon:"chevron-right",onClick:()=>g(Y+1)})]}):(0,u.Y)(n.A,{})]}),onDismiss:r,size:"md",children:[(0,u.Y)(p.A,{unsafeCSS:`
          .dev-error-modal pre {
              background: #111;
              border-radius: 8px;
              color: #efefef;
              line-height: 1.5;
              margin-top: 20px;
              max-height: 300px;
              padding: 16px;
              overflow: auto;
              white-space: pre-wrap;
              word-break: break-word;
            }
        `}),(0,u.Y)("div",{className:"dev-error-modal",children:(0,u.FD)(n.A,{marginTop:1,children:[(0,u.Y)(b.A,{weight:"bold",children:E.label}),(0,u.Y)("pre",{children:(0,u.Y)("code",{children:E.body})}),(0,u.Y)(b.A,{weight:"bold",children:w.label}),(0,u.Y)("pre",{children:(0,u.Y)("code",{children:w.body})})]})})]})})}l.d(r,{MaybeDevErrorModalRoot:()=>y,default:()=>f})}}]);
//# sourceMappingURL=https://sm.pinimg.com/webapp/57657-5c4356eb8d873aa7.mjs.map