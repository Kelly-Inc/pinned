(self.modernJsonp=self.modernJsonp||[]).push([[37705],{47740(e,t,i){i.r(t),i.d(t,{default:()=>S});var n=i(768540),o=i(923119),a=i(529750),l=i(149037),s=i(574120),r=i(516001),c=i(430875),u=i(360826),d=i(555249),p=i(924271),m=i(493532);let h="animated-text";function _({duration:e,show:t,text:i}){(0,o.useEffect)(()=>{(0,n.A)("CloseupButtonText","/app/common/react/components/auth-desktop-web-closeup/CloseupBody/CloseupImage/ImageOverlay/CloseupButtonText.tsx")},[]);let l=(0,o.useRef)(null),s=`
    .${h}-enter {
      opacity: 0;
    }
    .${h}-enter-active {
      opacity: 1;
      transition: opacity ${e}ms cubic-bezier(1,0,1,0);
    }
    .${h}-enter-done {
      opacity: 1;
    }
    .${h}-exit {
      opacity: 1;
    }
    .${h}-exit-active {
      opacity: 0;
      transition: opacity ${e}ms cubic-bezier(0,1,0,1);
    }
    .${h}-exit-done {
      opacity: 0;
    }
  `;return(0,m.FD)(o.Fragment,{children:[(0,m.Y)(p.A,{unsafeCSS:s}),(0,m.Y)(a.A,{appear:!0,classNames:h,in:t,nodeRef:l,timeout:e,children:(0,m.Y)(c.A,{ref:l,opacity:0,children:(0,m.Y)(d.A,{size:"300",children:i})})})]})}var g=i(905904),y=i(154412),A=i(278179),f=i(133846),w=i(680102),v=i(215943);let x="animated-button-container",b=`
  .${x}-enter  {
    width: 0px;
  }
  .${x}-enter-active {
    width: 100% !important;
    transition: width 250ms ease-in;
  }
  .${x}-enter-done {
    width: 100% !important;
  }
  .${x}-exit {
    width: 100% !important;
  }
  .${x}-exit-active {
    width: 0px !important;
    transition: width 250ms ease-in;
  }
  .${x}-exit-done {
    width: 0px;
  }
`;function S({animateOnMount:e,animationDelayOnMount:t=1e3,leaveOnDurationOnMount:i=3e3,dataTestId:d,icon:h,imageSignature:$,onAnimationStart:C,onMouseDown:z,onTap:Y,variant:B,ref:P}){(0,o.useEffect)(()=>{(0,n.A)("AnimatedCloseupButton","/app/common/react/components/auth-desktop-web-closeup/CloseupBody/CloseupImage/ImageOverlay/AnimatedCloseupButton.tsx")},[]);let{logContextEvent:k}=(0,o.use)(y.j),{isRTL:I}=(0,f._8)(),{isDarkMode:E}=(0,A.D2)(),T=(0,w.qJ)(),R=(0,o.useRef)(null),[D,F]=(0,o.useState)(!1),[L,M]=(0,o.useState)(!1),[j,J]=(0,o.useState)(!1),{isFocusVisible:N}=(0,l.A)(),O=D||L&&N,V=(0,g.A)({variant:B}),W=(0,o.useMemo)(()=>E&&T?"rgba(17, 17, 17, 0.9)":O?"var(--comp-button-color-hover-background-tertiary-semi-transparent-default)":"var(--comp-button-color-background-tertiary-semi-transparent-default)",[E,T,O]);return(0,v.A)(()=>{if(!e)return;let n=setTimeout(()=>{J(!0),C?.();let e=setTimeout(()=>{J(!1)},i);return()=>clearTimeout(e)},t);return()=>clearTimeout(n)}),(0,v.A)(()=>{let e=234;"view-larger"===B?e=15864:"collage-entry"===B&&(e=14180),k({event_type:120,component:128,element:e,view_type:3,aux_data:{image_signature:$}})}),(0,m.FD)(s.A,{ref:P,accessibilityLabel:V,onBlur:()=>M(!1),onFocus:()=>M(!0),onMouseDown:z,onMouseEnter:()=>F(!0),onMouseLeave:()=>F(!1),onTap:Y,rounding:"circle",children:[(0,m.Y)(p.A,{unsafeCSS:b}),(0,m.Y)(r.A,{alignItems:"stretch",justifyContent:"end",children:(0,m.Y)(a.A,{appear:!0,classNames:x,in:O||j,nodeRef:R,timeout:250,children:(0,m.FD)(c.A,{ref:R,alignItems:"center",dangerouslySetInlineStyle:{__style:{backgroundColor:W}},"data-test-id":d,display:"flex",justifyContent:"end",minHeight:48,minWidth:48,position:"relative",rounding:400,width:0,children:[(0,m.Y)(c.A,{dangerouslySetInlineStyle:{__style:{whiteSpace:"nowrap"}},marginEnd:2,marginStart:3,overflow:"hidden",children:(0,m.Y)(_,{duration:250,show:O||j,text:V})}),(0,m.Y)(c.A,{dangerouslySetInlineStyle:{__style:{paddingLeft:I?"12px":0,paddingRight:I?0:"12px"}},children:(0,m.Y)(u.A,{accessibilityLabel:V,color:"default",icon:h,size:24})})]})})})]})}},905904(e,t,i){var n=i(107048),o=i(133846),a=i(699254);function l({variant:e}){let t=(0,n.A)(),{isAuthenticated:i}=(0,o._8)(),{mWebCloseupRedesignEnabled:s}=(0,a.A)({skipExpActivation:!0});return"view-larger"===e?t._('View larger', 'closeup.image.mediaViewerButton', 'clicking on this button will open a full screen view of the Pin image'):"collage-entry"===e?t._('Add to collage', 'closeup.image.collageEntryButton', 'clicking on this button will add the Pin to a collage'):"visual-search"===e&&(i||s)?t._('Search image', 'closeup.image.visualSearchButton', 'clicking on this text will open a visual search feed'):t._('Explore', 'closeup.explore.icon', 'clicking on this text will open a visual search feed')}i.d(t,{A:()=>l})}}]);
//# sourceMappingURL=https://sm.pinimg.com/webapp/AnimatedCloseupButtonCommon-211666c5ca3e45db.mjs.map