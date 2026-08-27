import{a as e,c as t,i as n,l as r,n as i,o as a,r as o,s,t as c,u as l}from"./index-CeQTb7vU.js";function u(e){if(Array.isArray(e))return e.flatMap(e=>u(e));if(typeof e!=`string`)return[];let t=[],n=0,r,i,a,o,s,c=()=>{for(;n<e.length&&/\s/.test(e.charAt(n));)n+=1;return n<e.length},l=()=>(i=e.charAt(n),i!==`=`&&i!==`;`&&i!==`,`);for(;n<e.length;){for(r=n,s=!1;c();)if(i=e.charAt(n),i===`,`){for(a=n,n+=1,c(),o=n;n<e.length&&l();)n+=1;n<e.length&&e.charAt(n)===`=`?(s=!0,n=o,t.push(e.slice(r,a)),r=n):n=a+1}else n+=1;(!s||n>=e.length)&&t.push(e.slice(r))}return t}function d(e){return e instanceof Headers?e:Array.isArray(e)||typeof e==`object`?new Headers(e):null}function ee(...e){return e.reduce((e,t)=>{let n=d(t);if(!n)return e;for(let[t,r]of n.entries())t===`set-cookie`?u(r).forEach(t=>e.append(`set-cookie`,t)):e.set(t,r);return e},new Headers)}var f=i(`arrow-down-right`,[[`path`,{d:`m7 7 10 10`,key:`1fmybs`}],[`path`,{d:`M17 7v10H7`,key:`6fjiku`}]]),p=i(`arrow-up-right`,[[`path`,{d:`M7 7h10v10`,key:`1tivn9`}],[`path`,{d:`M7 17 17 7`,key:`1vkiza`}]]),m=i(`book-open`,[[`path`,{d:`M12 7v14`,key:`1akyts`}],[`path`,{d:`M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z`,key:`ruj8y`}]]),h=i(`check`,[[`path`,{d:`M20 6 9 17l-5-5`,key:`1gmf2c`}]]),g=i(`clipboard-list`,[[`rect`,{width:`8`,height:`4`,x:`8`,y:`2`,rx:`1`,ry:`1`,key:`tgr4d6`}],[`path`,{d:`M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2`,key:`116196`}],[`path`,{d:`M12 11h4`,key:`1jrz19`}],[`path`,{d:`M12 16h4`,key:`n85exb`}],[`path`,{d:`M8 11h.01`,key:`1dfujw`}],[`path`,{d:`M8 16h.01`,key:`18s6g9`}]]),_=i(`copy`,[[`rect`,{width:`14`,height:`14`,x:`8`,y:`8`,rx:`2`,ry:`2`,key:`17jyea`}],[`path`,{d:`M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2`,key:`zix9uf`}]]),v=i(`download`,[[`path`,{d:`M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4`,key:`ih7n3h`}],[`polyline`,{points:`7 10 12 15 17 10`,key:`2ggqvy`}],[`line`,{x1:`12`,x2:`12`,y1:`15`,y2:`3`,key:`1vk2je`}]]),y=i(`external-link`,[[`path`,{d:`M15 3h6v6`,key:`1q9fwt`}],[`path`,{d:`M10 14 21 3`,key:`gplh6r`}],[`path`,{d:`M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6`,key:`a6xqqp`}]]),b=i(`key-round`,[[`path`,{d:`M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z`,key:`1s6t7t`}],[`circle`,{cx:`16.5`,cy:`7.5`,r:`.5`,fill:`currentColor`,key:`w0ekpg`}]]),x=i(`layout-grid`,[[`rect`,{width:`7`,height:`7`,x:`3`,y:`3`,rx:`1`,key:`1g98yp`}],[`rect`,{width:`7`,height:`7`,x:`14`,y:`3`,rx:`1`,key:`6d4xhi`}],[`rect`,{width:`7`,height:`7`,x:`14`,y:`14`,rx:`1`,key:`nxv5o0`}],[`rect`,{width:`7`,height:`7`,x:`3`,y:`14`,rx:`1`,key:`1bb6yr`}]]),S=i(`loader-circle`,[[`path`,{d:`M21 12a9 9 0 1 1-6.219-8.56`,key:`13zald`}]]),C=i(`plus`,[[`path`,{d:`M5 12h14`,key:`1ays0h`}],[`path`,{d:`M12 5v14`,key:`s699le`}]]),w=i(`send`,[[`path`,{d:`M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z`,key:`1ffxy3`}],[`path`,{d:`m21.854 2.147-10.94 10.939`,key:`12cjpa`}]]),te=i(`sparkles`,[[`path`,{d:`M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z`,key:`4pj2yx`}],[`path`,{d:`M20 3v4`,key:`1olli1`}],[`path`,{d:`M22 5h-4`,key:`1gvqau`}],[`path`,{d:`M4 17v2`,key:`vumght`}],[`path`,{d:`M5 18H3`,key:`zchphs`}]]);function ne(e){var t,n,r=``;if(typeof e==`string`||typeof e==`number`)r+=e;else if(typeof e==`object`){if(Array.isArray(e)){var i=e.length;for(t=0;t<i;t++)e[t]&&(n=ne(e[t]))&&(r&&(r+=` `),r+=n)}else for(n in e)e[n]&&(r&&(r+=` `),r+=n)}return r}function T(){for(var e,t,n=0,r=``,i=arguments.length;n<i;n++)(e=arguments[n])&&(t=ne(e))&&(r&&(r+=` `),r+=t);return r}var re=(e,t)=>{let n=Array(e.length+t.length);for(let t=0;t<e.length;t++)n[t]=e[t];for(let r=0;r<t.length;r++)n[e.length+r]=t[r];return n},ie=(e,t)=>({classGroupId:e,validator:t}),E=(e=new Map,t=null,n)=>({nextPart:e,validators:t,classGroupId:n}),D=`-`,O=[],ae=`arbitrary..`,oe=e=>{let t=ce(e),{conflictingClassGroups:n,conflictingClassGroupModifiers:r}=e;return{getClassGroupId:e=>{if(e.startsWith(`[`)&&e.endsWith(`]`))return se(e);let n=e.split(D);return k(n,+(n[0]===``&&n.length>1),t)},getConflictingClassGroupIds:(e,t)=>{if(t){let t=r[e],i=n[e];return t?i?re(i,t):t:i||O}return n[e]||O}}},k=(e,t,n)=>{if(e.length-t===0)return n.classGroupId;let r=e[t],i=n.nextPart.get(r);if(i){let n=k(e,t+1,i);if(n)return n}let a=n.validators;if(a===null)return;let o=t===0?e.join(D):e.slice(t).join(D),s=a.length;for(let e=0;e<s;e++){let t=a[e];if(t.validator(o))return t.classGroupId}},se=e=>e.slice(1,-1).indexOf(`:`)===-1?void 0:(()=>{let t=e.slice(1,-1),n=t.indexOf(`:`),r=t.slice(0,n);return r?ae+r:void 0})(),ce=e=>{let{theme:t,classGroups:n}=e;return le(n,t)},le=(e,t)=>{let n=E();for(let r in e){let i=e[r];A(i,n,r,t)}return n},A=(e,t,n,r)=>{let i=e.length;for(let a=0;a<i;a++){let i=e[a];j(i,t,n,r)}},j=(e,t,n,r)=>{if(typeof e==`string`){M(e,t,n);return}if(typeof e==`function`){ue(e,t,n,r);return}de(e,t,n,r)},M=(e,t,n)=>{let r=e===``?t:N(t,e);r.classGroupId=n},ue=(e,t,n,r)=>{if(fe(e)){A(e(r),t,n,r);return}t.validators===null&&(t.validators=[]),t.validators.push(ie(n,e))},de=(e,t,n,r)=>{let i=Object.entries(e),a=i.length;for(let e=0;e<a;e++){let[a,o]=i[e];A(o,N(t,a),n,r)}},N=(e,t)=>{let n=e,r=t.split(D),i=r.length;for(let e=0;e<i;e++){let t=r[e],i=n.nextPart.get(t);i||(i=E(),n.nextPart.set(t,i)),n=i}return n},fe=e=>`isThemeGetter`in e&&e.isThemeGetter===!0,pe=e=>{if(e<1)return{get:()=>void 0,set:()=>{}};let t=0,n=Object.create(null),r=Object.create(null),i=(i,a)=>{n[i]=a,t++,t>e&&(t=0,r=n,n=Object.create(null))};return{get(e){let t=n[e];if(t!==void 0)return t;if((t=r[e])!==void 0)return i(e,t),t},set(e,t){e in n?n[e]=t:i(e,t)}}},P=`!`,me=`:`,he=[],ge=(e,t,n,r,i)=>({modifiers:e,hasImportantModifier:t,baseClassName:n,maybePostfixModifierPosition:r,isExternal:i}),_e=e=>{let{prefix:t,experimentalParseClassName:n}=e,r=e=>{let t=[],n=0,r=0,i=0,a,o=e.length;for(let s=0;s<o;s++){let o=e[s];if(n===0&&r===0){if(o===me){t.push(e.slice(i,s)),i=s+1;continue}if(o===`/`){a=s;continue}}o===`[`?n++:o===`]`?n--:o===`(`?r++:o===`)`&&r--}let s=t.length===0?e:e.slice(i),c=s,l=!1;s.endsWith(P)?(c=s.slice(0,-1),l=!0):s.startsWith(P)&&(c=s.slice(1),l=!0);let u=a&&a>i?a-i:void 0;return ge(t,l,c,u)};if(t){let e=t+me,n=r;r=t=>t.startsWith(e)?n(t.slice(e.length)):ge(he,!1,t,void 0,!0)}if(n){let e=r;r=t=>n({className:t,parseClassName:e})}return r},ve=e=>{let t=new Map;return e.orderSensitiveModifiers.forEach((e,n)=>{t.set(e,1e6+n)}),e=>{let n=[],r=[];for(let i=0;i<e.length;i++){let a=e[i],o=a[0]===`[`,s=t.has(a);o||s?(r.length>0&&(r.sort(),n.push(...r),r=[]),n.push(a)):r.push(a)}return r.length>0&&(r.sort(),n.push(...r)),n}},ye=e=>({cache:pe(e.cacheSize),parseClassName:_e(e),sortModifiers:ve(e),postfixLookupClassGroupIds:be(e),...oe(e)}),be=e=>{let t=Object.create(null),n=e.postfixLookupClassGroups;if(n)for(let e=0;e<n.length;e++)t[n[e]]=!0;return t},xe=/\s+/,Se=(e,t)=>{let{parseClassName:n,getClassGroupId:r,getConflictingClassGroupIds:i,sortModifiers:a,postfixLookupClassGroupIds:o}=t,s=[],c=e.trim().split(xe),l=``;for(let e=c.length-1;e>=0;--e){let t=c[e],{isExternal:u,modifiers:d,hasImportantModifier:ee,baseClassName:f,maybePostfixModifierPosition:p}=n(t);if(u){l=t+(l.length>0?` `+l:l);continue}let m=!!p,h;if(m){h=r(f.substring(0,p));let e=h&&o[h]?r(f):void 0;e&&e!==h&&(h=e,m=!1)}else h=r(f);if(!h){if(!m){l=t+(l.length>0?` `+l:l);continue}if(h=r(f),!h){l=t+(l.length>0?` `+l:l);continue}m=!1}let g=d.length===0?``:d.length===1?d[0]:a(d).join(`:`),_=ee?g+P:g,v=_+h;if(s.indexOf(v)>-1)continue;s.push(v);let y=i(h,m);for(let e=0;e<y.length;++e){let t=y[e];s.push(_+t)}l=t+(l.length>0?` `+l:l)}return l},Ce=(...e)=>{let t=0,n,r,i=``;for(;t<e.length;)(n=e[t++])&&(r=we(n))&&(i&&(i+=` `),i+=r);return i},we=e=>{if(typeof e==`string`)return e;let t,n=``;for(let r=0;r<e.length;r++)e[r]&&(t=we(e[r]))&&(n&&(n+=` `),n+=t);return n},Te=(e,...t)=>{let n,r,i,a,o=o=>(n=ye(t.reduce((e,t)=>t(e),e())),r=n.cache.get,i=n.cache.set,a=s,s(o)),s=e=>{let t=r(e);if(t)return t;let a=Se(e,n);return i(e,a),a};return a=o,(...e)=>a(Ce(...e))},Ee=[],F=e=>{let t=t=>t[e]||Ee;return t.isThemeGetter=!0,t},De=/^\[(?:(\w[\w-]*):)?(.+)\]$/i,Oe=/^\((?:(\w[\w-]*):)?(.+)\)$/i,ke=/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/,Ae=/^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,je=/\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,Me=/^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,Ne=/^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,Pe=/^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,I=e=>ke.test(e),L=e=>!!e&&!Number.isNaN(Number(e)),R=e=>!!e&&Number.isInteger(Number(e)),Fe=e=>e.endsWith(`%`)&&L(e.slice(0,-1)),z=e=>Ae.test(e),Ie=()=>!0,Le=e=>je.test(e)&&!Me.test(e),Re=()=>!1,ze=e=>Ne.test(e),Be=e=>Pe.test(e),Ve=e=>!B(e)&&!H(e),He=e=>e.startsWith(`@container`)&&(e[10]===`/`&&e[11]!==void 0||e[11]===`s`&&e[16]!==void 0&&e.startsWith(`-size/`,10)||e[11]===`n`&&e[18]!==void 0&&e.startsWith(`-normal/`,10)),Ue=e=>U(e,at,Re),B=e=>De.test(e),V=e=>U(e,ot,Le),We=e=>U(e,st,L),Ge=e=>U(e,lt,Ie),Ke=e=>U(e,ct,Re),qe=e=>U(e,rt,Re),Je=e=>U(e,it,Be),Ye=e=>U(e,ut,ze),H=e=>Oe.test(e),Xe=e=>W(e,ot),Ze=e=>W(e,ct),Qe=e=>W(e,rt),$e=e=>W(e,at),et=e=>W(e,it),tt=e=>W(e,ut,!0),nt=e=>W(e,lt,!0),U=(e,t,n)=>{let r=De.exec(e);return r?r[1]?t(r[1]):n(r[2]):!1},W=(e,t,n=!1)=>{let r=Oe.exec(e);return r?r[1]?t(r[1]):n:!1},rt=e=>e===`position`||e===`percentage`,it=e=>e===`image`||e===`url`,at=e=>e===`length`||e===`size`||e===`bg-size`,ot=e=>e===`length`,st=e=>e===`number`,ct=e=>e===`family-name`,lt=e=>e===`number`||e===`weight`,ut=e=>e===`shadow`,dt=Te(()=>{let e=F(`color`),t=F(`font`),n=F(`text`),r=F(`font-weight`),i=F(`tracking`),a=F(`leading`),o=F(`breakpoint`),s=F(`container`),c=F(`spacing`),l=F(`radius`),u=F(`shadow`),d=F(`inset-shadow`),ee=F(`text-shadow`),f=F(`drop-shadow`),p=F(`blur`),m=F(`perspective`),h=F(`aspect`),g=F(`ease`),_=F(`animate`),v=()=>[`auto`,`avoid`,`all`,`avoid-page`,`page`,`left`,`right`,`column`],y=()=>[`center`,`top`,`bottom`,`left`,`right`,`top-left`,`left-top`,`top-right`,`right-top`,`bottom-right`,`right-bottom`,`bottom-left`,`left-bottom`],b=()=>[...y(),H,B],x=()=>[`auto`,`hidden`,`clip`,`visible`,`scroll`],S=()=>[`auto`,`contain`,`none`],C=()=>[H,B,c],w=()=>[I,`full`,`auto`,...C()],te=()=>[R,`none`,`subgrid`,H,B],ne=()=>[`auto`,{span:[`full`,R,H,B]},R,H,B],T=()=>[R,`auto`,H,B],re=()=>[`auto`,`min`,`max`,`fr`,H,B],ie=()=>[`start`,`end`,`center`,`between`,`around`,`evenly`,`stretch`,`baseline`,`center-safe`,`end-safe`],E=()=>[`start`,`end`,`center`,`stretch`,`center-safe`,`end-safe`],D=()=>[`auto`,...C()],O=()=>[I,`auto`,`full`,`dvw`,`dvh`,`lvw`,`lvh`,`svw`,`svh`,`min`,`max`,`fit`,...C()],ae=()=>[I,`screen`,`full`,`dvw`,`lvw`,`svw`,`min`,`max`,`fit`,...C()],oe=()=>[I,`screen`,`full`,`lh`,`dvh`,`lvh`,`svh`,`min`,`max`,`fit`,...C()],k=()=>[e,H,B],se=()=>[...y(),Qe,qe,{position:[H,B]}],ce=()=>[`no-repeat`,{repeat:[``,`x`,`y`,`space`,`round`]}],le=()=>[`auto`,`cover`,`contain`,$e,Ue,{size:[H,B]}],A=()=>[Fe,Xe,V],j=()=>[``,`none`,`full`,l,H,B],M=()=>[``,L,Xe,V],ue=()=>[`solid`,`dashed`,`dotted`,`double`],de=()=>[`normal`,`multiply`,`screen`,`overlay`,`darken`,`lighten`,`color-dodge`,`color-burn`,`hard-light`,`soft-light`,`difference`,`exclusion`,`hue`,`saturation`,`color`,`luminosity`],N=()=>[L,Fe,Qe,qe],fe=()=>[``,`none`,p,H,B],pe=()=>[`none`,L,H,B],P=()=>[`none`,L,H,B],me=()=>[L,H,B],he=()=>[I,`full`,...C()];return{cacheSize:500,theme:{animate:[`spin`,`ping`,`pulse`,`bounce`],aspect:[`video`],blur:[z],breakpoint:[z],color:[Ie],container:[z],"drop-shadow":[z],ease:[`in`,`out`,`in-out`],font:[Ve],"font-weight":[`thin`,`extralight`,`light`,`normal`,`medium`,`semibold`,`bold`,`extrabold`,`black`],"inset-shadow":[z],leading:[`none`,`tight`,`snug`,`normal`,`relaxed`,`loose`],perspective:[`dramatic`,`near`,`normal`,`midrange`,`distant`,`none`],radius:[z],shadow:[z],spacing:[`px`,L],text:[z],"text-shadow":[z],tracking:[`tighter`,`tight`,`normal`,`wide`,`wider`,`widest`]},classGroups:{aspect:[{aspect:[`auto`,`square`,I,B,H,h]}],container:[`container`],"container-type":[{"@container":[``,`normal`,`size`,H,B]}],"container-named":[He],columns:[{columns:[L,B,H,s]}],"break-after":[{"break-after":v()}],"break-before":[{"break-before":v()}],"break-inside":[{"break-inside":[`auto`,`avoid`,`avoid-page`,`avoid-column`]}],"box-decoration":[{"box-decoration":[`slice`,`clone`]}],box:[{box:[`border`,`content`]}],display:[`block`,`inline-block`,`inline`,`flex`,`inline-flex`,`table`,`inline-table`,`table-caption`,`table-cell`,`table-column`,`table-column-group`,`table-footer-group`,`table-header-group`,`table-row-group`,`table-row`,`flow-root`,`grid`,`inline-grid`,`contents`,`list-item`,`hidden`],sr:[`sr-only`,`not-sr-only`],float:[{float:[`right`,`left`,`none`,`start`,`end`]}],clear:[{clear:[`left`,`right`,`both`,`none`,`start`,`end`]}],isolation:[`isolate`,`isolation-auto`],"object-fit":[{object:[`contain`,`cover`,`fill`,`none`,`scale-down`]}],"object-position":[{object:b()}],overflow:[{overflow:x()}],"overflow-x":[{"overflow-x":x()}],"overflow-y":[{"overflow-y":x()}],overscroll:[{overscroll:S()}],"overscroll-x":[{"overscroll-x":S()}],"overscroll-y":[{"overscroll-y":S()}],position:[`static`,`fixed`,`absolute`,`relative`,`sticky`],inset:[{inset:w()}],"inset-x":[{"inset-x":w()}],"inset-y":[{"inset-y":w()}],start:[{"inset-s":w(),start:w()}],end:[{"inset-e":w(),end:w()}],"inset-bs":[{"inset-bs":w()}],"inset-be":[{"inset-be":w()}],top:[{top:w()}],right:[{right:w()}],bottom:[{bottom:w()}],left:[{left:w()}],visibility:[`visible`,`invisible`,`collapse`],z:[{z:[R,`auto`,H,B]}],basis:[{basis:[I,`full`,`auto`,s,...C()]}],"flex-direction":[{flex:[`row`,`row-reverse`,`col`,`col-reverse`]}],"flex-wrap":[{flex:[`nowrap`,`wrap`,`wrap-reverse`]}],flex:[{flex:[L,I,`auto`,`initial`,`none`,B]}],grow:[{grow:[``,L,H,B]}],shrink:[{shrink:[``,L,H,B]}],order:[{order:[R,`first`,`last`,`none`,H,B]}],"grid-cols":[{"grid-cols":te()}],"col-start-end":[{col:ne()}],"col-start":[{"col-start":T()}],"col-end":[{"col-end":T()}],"grid-rows":[{"grid-rows":te()}],"row-start-end":[{row:ne()}],"row-start":[{"row-start":T()}],"row-end":[{"row-end":T()}],"grid-flow":[{"grid-flow":[`row`,`col`,`dense`,`row-dense`,`col-dense`]}],"auto-cols":[{"auto-cols":re()}],"auto-rows":[{"auto-rows":re()}],gap:[{gap:C()}],"gap-x":[{"gap-x":C()}],"gap-y":[{"gap-y":C()}],"justify-content":[{justify:[...ie(),`normal`]}],"justify-items":[{"justify-items":[...E(),`normal`]}],"justify-self":[{"justify-self":[`auto`,...E()]}],"align-content":[{content:[`normal`,...ie()]}],"align-items":[{items:[...E(),{baseline:[``,`last`]}]}],"align-self":[{self:[`auto`,...E(),{baseline:[``,`last`]}]}],"place-content":[{"place-content":ie()}],"place-items":[{"place-items":[...E(),`baseline`]}],"place-self":[{"place-self":[`auto`,...E()]}],p:[{p:C()}],px:[{px:C()}],py:[{py:C()}],ps:[{ps:C()}],pe:[{pe:C()}],pbs:[{pbs:C()}],pbe:[{pbe:C()}],pt:[{pt:C()}],pr:[{pr:C()}],pb:[{pb:C()}],pl:[{pl:C()}],m:[{m:D()}],mx:[{mx:D()}],my:[{my:D()}],ms:[{ms:D()}],me:[{me:D()}],mbs:[{mbs:D()}],mbe:[{mbe:D()}],mt:[{mt:D()}],mr:[{mr:D()}],mb:[{mb:D()}],ml:[{ml:D()}],"space-x":[{"space-x":C()}],"space-x-reverse":[`space-x-reverse`],"space-y":[{"space-y":C()}],"space-y-reverse":[`space-y-reverse`],size:[{size:O()}],"inline-size":[{inline:[`auto`,...ae()]}],"min-inline-size":[{"min-inline":[`auto`,...ae()]}],"max-inline-size":[{"max-inline":[`none`,...ae()]}],"block-size":[{block:[`auto`,...oe()]}],"min-block-size":[{"min-block":[`auto`,...oe()]}],"max-block-size":[{"max-block":[`none`,...oe()]}],w:[{w:[s,`screen`,...O()]}],"min-w":[{"min-w":[s,`screen`,`none`,...O()]}],"max-w":[{"max-w":[s,`screen`,`none`,`prose`,{screen:[o]},...O()]}],h:[{h:[`screen`,`lh`,...O()]}],"min-h":[{"min-h":[`screen`,`lh`,`none`,...O()]}],"max-h":[{"max-h":[`screen`,`lh`,...O()]}],"font-size":[{text:[`base`,n,Xe,V]}],"font-smoothing":[`antialiased`,`subpixel-antialiased`],"font-style":[`italic`,`not-italic`],"font-weight":[{font:[r,nt,Ge]}],"font-stretch":[{"font-stretch":[`ultra-condensed`,`extra-condensed`,`condensed`,`semi-condensed`,`normal`,`semi-expanded`,`expanded`,`extra-expanded`,`ultra-expanded`,Fe,B]}],"font-family":[{font:[Ze,Ke,t]}],"font-features":[{"font-features":[B]}],"fvn-normal":[`normal-nums`],"fvn-ordinal":[`ordinal`],"fvn-slashed-zero":[`slashed-zero`],"fvn-figure":[`lining-nums`,`oldstyle-nums`],"fvn-spacing":[`proportional-nums`,`tabular-nums`],"fvn-fraction":[`diagonal-fractions`,`stacked-fractions`],tracking:[{tracking:[i,H,B]}],"line-clamp":[{"line-clamp":[L,`none`,H,We]}],leading:[{leading:[a,...C()]}],"list-image":[{"list-image":[`none`,H,B]}],"list-style-position":[{list:[`inside`,`outside`]}],"list-style-type":[{list:[`disc`,`decimal`,`none`,H,B]}],"text-alignment":[{text:[`left`,`center`,`right`,`justify`,`start`,`end`]}],"placeholder-color":[{placeholder:k()}],"text-color":[{text:k()}],"text-decoration":[`underline`,`overline`,`line-through`,`no-underline`],"text-decoration-style":[{decoration:[...ue(),`wavy`]}],"text-decoration-thickness":[{decoration:[L,`from-font`,`auto`,H,V]}],"text-decoration-color":[{decoration:k()}],"underline-offset":[{"underline-offset":[L,`auto`,H,B]}],"text-transform":[`uppercase`,`lowercase`,`capitalize`,`normal-case`],"text-overflow":[`truncate`,`text-ellipsis`,`text-clip`],"text-wrap":[{text:[`wrap`,`nowrap`,`balance`,`pretty`]}],indent:[{indent:C()}],"tab-size":[{tab:[R,H,B]}],"vertical-align":[{align:[`baseline`,`top`,`middle`,`bottom`,`text-top`,`text-bottom`,`sub`,`super`,H,B]}],whitespace:[{whitespace:[`normal`,`nowrap`,`pre`,`pre-line`,`pre-wrap`,`break-spaces`]}],break:[{break:[`normal`,`words`,`all`,`keep`]}],wrap:[{wrap:[`break-word`,`anywhere`,`normal`]}],hyphens:[{hyphens:[`none`,`manual`,`auto`]}],content:[{content:[`none`,H,B]}],"bg-attachment":[{bg:[`fixed`,`local`,`scroll`]}],"bg-clip":[{"bg-clip":[`border`,`padding`,`content`,`text`]}],"bg-origin":[{"bg-origin":[`border`,`padding`,`content`]}],"bg-position":[{bg:se()}],"bg-repeat":[{bg:ce()}],"bg-size":[{bg:le()}],"bg-image":[{bg:[`none`,{linear:[{to:[`t`,`tr`,`r`,`br`,`b`,`bl`,`l`,`tl`]},R,H,B],radial:[``,H,B],conic:[R,H,B]},et,Je]}],"bg-color":[{bg:k()}],"gradient-from-pos":[{from:A()}],"gradient-via-pos":[{via:A()}],"gradient-to-pos":[{to:A()}],"gradient-from":[{from:k()}],"gradient-via":[{via:k()}],"gradient-to":[{to:k()}],rounded:[{rounded:j()}],"rounded-s":[{"rounded-s":j()}],"rounded-e":[{"rounded-e":j()}],"rounded-t":[{"rounded-t":j()}],"rounded-r":[{"rounded-r":j()}],"rounded-b":[{"rounded-b":j()}],"rounded-l":[{"rounded-l":j()}],"rounded-ss":[{"rounded-ss":j()}],"rounded-se":[{"rounded-se":j()}],"rounded-ee":[{"rounded-ee":j()}],"rounded-es":[{"rounded-es":j()}],"rounded-tl":[{"rounded-tl":j()}],"rounded-tr":[{"rounded-tr":j()}],"rounded-br":[{"rounded-br":j()}],"rounded-bl":[{"rounded-bl":j()}],"border-w":[{border:M()}],"border-w-x":[{"border-x":M()}],"border-w-y":[{"border-y":M()}],"border-w-s":[{"border-s":M()}],"border-w-e":[{"border-e":M()}],"border-w-bs":[{"border-bs":M()}],"border-w-be":[{"border-be":M()}],"border-w-t":[{"border-t":M()}],"border-w-r":[{"border-r":M()}],"border-w-b":[{"border-b":M()}],"border-w-l":[{"border-l":M()}],"divide-x":[{"divide-x":M()}],"divide-x-reverse":[`divide-x-reverse`],"divide-y":[{"divide-y":M()}],"divide-y-reverse":[`divide-y-reverse`],"border-style":[{border:[...ue(),`hidden`,`none`]}],"divide-style":[{divide:[...ue(),`hidden`,`none`]}],"border-color":[{border:k()}],"border-color-x":[{"border-x":k()}],"border-color-y":[{"border-y":k()}],"border-color-s":[{"border-s":k()}],"border-color-e":[{"border-e":k()}],"border-color-bs":[{"border-bs":k()}],"border-color-be":[{"border-be":k()}],"border-color-t":[{"border-t":k()}],"border-color-r":[{"border-r":k()}],"border-color-b":[{"border-b":k()}],"border-color-l":[{"border-l":k()}],"divide-color":[{divide:k()}],"outline-style":[{outline:[...ue(),`none`,`hidden`]}],"outline-offset":[{"outline-offset":[L,H,B]}],"outline-w":[{outline:[``,L,Xe,V]}],"outline-color":[{outline:k()}],shadow:[{shadow:[``,`none`,u,tt,Ye]}],"shadow-color":[{shadow:k()}],"inset-shadow":[{"inset-shadow":[`none`,d,tt,Ye]}],"inset-shadow-color":[{"inset-shadow":k()}],"ring-w":[{ring:M()}],"ring-w-inset":[`ring-inset`],"ring-color":[{ring:k()}],"ring-offset-w":[{"ring-offset":[L,V]}],"ring-offset-color":[{"ring-offset":k()}],"inset-ring-w":[{"inset-ring":M()}],"inset-ring-color":[{"inset-ring":k()}],"text-shadow":[{"text-shadow":[`none`,ee,tt,Ye]}],"text-shadow-color":[{"text-shadow":k()}],opacity:[{opacity:[L,H,B]}],"mix-blend":[{"mix-blend":[...de(),`plus-darker`,`plus-lighter`]}],"bg-blend":[{"bg-blend":de()}],"mask-clip":[{"mask-clip":[`border`,`padding`,`content`,`fill`,`stroke`,`view`]},`mask-no-clip`],"mask-composite":[{mask:[`add`,`subtract`,`intersect`,`exclude`]}],"mask-image-linear-pos":[{"mask-linear":[L]}],"mask-image-linear-from-pos":[{"mask-linear-from":N()}],"mask-image-linear-to-pos":[{"mask-linear-to":N()}],"mask-image-linear-from-color":[{"mask-linear-from":k()}],"mask-image-linear-to-color":[{"mask-linear-to":k()}],"mask-image-t-from-pos":[{"mask-t-from":N()}],"mask-image-t-to-pos":[{"mask-t-to":N()}],"mask-image-t-from-color":[{"mask-t-from":k()}],"mask-image-t-to-color":[{"mask-t-to":k()}],"mask-image-r-from-pos":[{"mask-r-from":N()}],"mask-image-r-to-pos":[{"mask-r-to":N()}],"mask-image-r-from-color":[{"mask-r-from":k()}],"mask-image-r-to-color":[{"mask-r-to":k()}],"mask-image-b-from-pos":[{"mask-b-from":N()}],"mask-image-b-to-pos":[{"mask-b-to":N()}],"mask-image-b-from-color":[{"mask-b-from":k()}],"mask-image-b-to-color":[{"mask-b-to":k()}],"mask-image-l-from-pos":[{"mask-l-from":N()}],"mask-image-l-to-pos":[{"mask-l-to":N()}],"mask-image-l-from-color":[{"mask-l-from":k()}],"mask-image-l-to-color":[{"mask-l-to":k()}],"mask-image-x-from-pos":[{"mask-x-from":N()}],"mask-image-x-to-pos":[{"mask-x-to":N()}],"mask-image-x-from-color":[{"mask-x-from":k()}],"mask-image-x-to-color":[{"mask-x-to":k()}],"mask-image-y-from-pos":[{"mask-y-from":N()}],"mask-image-y-to-pos":[{"mask-y-to":N()}],"mask-image-y-from-color":[{"mask-y-from":k()}],"mask-image-y-to-color":[{"mask-y-to":k()}],"mask-image-radial":[{"mask-radial":[H,B]}],"mask-image-radial-from-pos":[{"mask-radial-from":N()}],"mask-image-radial-to-pos":[{"mask-radial-to":N()}],"mask-image-radial-from-color":[{"mask-radial-from":k()}],"mask-image-radial-to-color":[{"mask-radial-to":k()}],"mask-image-radial-shape":[{"mask-radial":[`circle`,`ellipse`]}],"mask-image-radial-size":[{"mask-radial":[{closest:[`side`,`corner`],farthest:[`side`,`corner`]}]}],"mask-image-radial-pos":[{"mask-radial-at":y()}],"mask-image-conic-pos":[{"mask-conic":[L]}],"mask-image-conic-from-pos":[{"mask-conic-from":N()}],"mask-image-conic-to-pos":[{"mask-conic-to":N()}],"mask-image-conic-from-color":[{"mask-conic-from":k()}],"mask-image-conic-to-color":[{"mask-conic-to":k()}],"mask-mode":[{mask:[`alpha`,`luminance`,`match`]}],"mask-origin":[{"mask-origin":[`border`,`padding`,`content`,`fill`,`stroke`,`view`]}],"mask-position":[{mask:se()}],"mask-repeat":[{mask:ce()}],"mask-size":[{mask:le()}],"mask-type":[{"mask-type":[`alpha`,`luminance`]}],"mask-image":[{mask:[`none`,H,B]}],filter:[{filter:[``,`none`,H,B]}],blur:[{blur:fe()}],brightness:[{brightness:[L,H,B]}],contrast:[{contrast:[L,H,B]}],"drop-shadow":[{"drop-shadow":[``,`none`,f,tt,Ye]}],"drop-shadow-color":[{"drop-shadow":k()}],grayscale:[{grayscale:[``,L,H,B]}],"hue-rotate":[{"hue-rotate":[L,H,B]}],invert:[{invert:[``,L,H,B]}],saturate:[{saturate:[L,H,B]}],sepia:[{sepia:[``,L,H,B]}],"backdrop-filter":[{"backdrop-filter":[``,`none`,H,B]}],"backdrop-blur":[{"backdrop-blur":fe()}],"backdrop-brightness":[{"backdrop-brightness":[L,H,B]}],"backdrop-contrast":[{"backdrop-contrast":[L,H,B]}],"backdrop-grayscale":[{"backdrop-grayscale":[``,L,H,B]}],"backdrop-hue-rotate":[{"backdrop-hue-rotate":[L,H,B]}],"backdrop-invert":[{"backdrop-invert":[``,L,H,B]}],"backdrop-opacity":[{"backdrop-opacity":[L,H,B]}],"backdrop-saturate":[{"backdrop-saturate":[L,H,B]}],"backdrop-sepia":[{"backdrop-sepia":[``,L,H,B]}],"border-collapse":[{border:[`collapse`,`separate`]}],"border-spacing":[{"border-spacing":C()}],"border-spacing-x":[{"border-spacing-x":C()}],"border-spacing-y":[{"border-spacing-y":C()}],"table-layout":[{table:[`auto`,`fixed`]}],caption:[{caption:[`top`,`bottom`]}],transition:[{transition:[``,`all`,`colors`,`opacity`,`shadow`,`transform`,`none`,H,B]}],"transition-behavior":[{transition:[`normal`,`discrete`]}],duration:[{duration:[L,`initial`,H,B]}],ease:[{ease:[`linear`,`initial`,g,H,B]}],delay:[{delay:[L,H,B]}],animate:[{animate:[`none`,_,H,B]}],backface:[{backface:[`hidden`,`visible`]}],perspective:[{perspective:[m,H,B]}],"perspective-origin":[{"perspective-origin":b()}],rotate:[{rotate:pe()}],"rotate-x":[{"rotate-x":pe()}],"rotate-y":[{"rotate-y":pe()}],"rotate-z":[{"rotate-z":pe()}],scale:[{scale:P()}],"scale-x":[{"scale-x":P()}],"scale-y":[{"scale-y":P()}],"scale-z":[{"scale-z":P()}],"scale-3d":[`scale-3d`],skew:[{skew:me()}],"skew-x":[{"skew-x":me()}],"skew-y":[{"skew-y":me()}],transform:[{transform:[H,B,``,`none`,`gpu`,`cpu`]}],"transform-origin":[{origin:b()}],"transform-style":[{transform:[`3d`,`flat`]}],translate:[{translate:he()}],"translate-x":[{"translate-x":he()}],"translate-y":[{"translate-y":he()}],"translate-z":[{"translate-z":he()}],"translate-none":[`translate-none`],zoom:[{zoom:[R,H,B]}],accent:[{accent:k()}],appearance:[{appearance:[`none`,`auto`]}],"caret-color":[{caret:k()}],"color-scheme":[{scheme:[`normal`,`dark`,`light`,`light-dark`,`only-dark`,`only-light`]}],cursor:[{cursor:[`auto`,`default`,`pointer`,`wait`,`text`,`move`,`help`,`not-allowed`,`none`,`context-menu`,`progress`,`cell`,`crosshair`,`vertical-text`,`alias`,`copy`,`no-drop`,`grab`,`grabbing`,`all-scroll`,`col-resize`,`row-resize`,`n-resize`,`e-resize`,`s-resize`,`w-resize`,`ne-resize`,`nw-resize`,`se-resize`,`sw-resize`,`ew-resize`,`ns-resize`,`nesw-resize`,`nwse-resize`,`zoom-in`,`zoom-out`,H,B]}],"field-sizing":[{"field-sizing":[`fixed`,`content`]}],"pointer-events":[{"pointer-events":[`auto`,`none`]}],resize:[{resize:[`none`,``,`y`,`x`]}],"scroll-behavior":[{scroll:[`auto`,`smooth`]}],"scrollbar-thumb-color":[{"scrollbar-thumb":k()}],"scrollbar-track-color":[{"scrollbar-track":k()}],"scrollbar-gutter":[{"scrollbar-gutter":[`auto`,`stable`,`both`]}],"scrollbar-w":[{scrollbar:[`auto`,`thin`,`none`]}],"scroll-m":[{"scroll-m":C()}],"scroll-mx":[{"scroll-mx":C()}],"scroll-my":[{"scroll-my":C()}],"scroll-ms":[{"scroll-ms":C()}],"scroll-me":[{"scroll-me":C()}],"scroll-mbs":[{"scroll-mbs":C()}],"scroll-mbe":[{"scroll-mbe":C()}],"scroll-mt":[{"scroll-mt":C()}],"scroll-mr":[{"scroll-mr":C()}],"scroll-mb":[{"scroll-mb":C()}],"scroll-ml":[{"scroll-ml":C()}],"scroll-p":[{"scroll-p":C()}],"scroll-px":[{"scroll-px":C()}],"scroll-py":[{"scroll-py":C()}],"scroll-ps":[{"scroll-ps":C()}],"scroll-pe":[{"scroll-pe":C()}],"scroll-pbs":[{"scroll-pbs":C()}],"scroll-pbe":[{"scroll-pbe":C()}],"scroll-pt":[{"scroll-pt":C()}],"scroll-pr":[{"scroll-pr":C()}],"scroll-pb":[{"scroll-pb":C()}],"scroll-pl":[{"scroll-pl":C()}],"snap-align":[{snap:[`start`,`end`,`center`,`align-none`]}],"snap-stop":[{snap:[`normal`,`always`]}],"snap-type":[{snap:[`none`,`x`,`y`,`both`]}],"snap-strictness":[{snap:[`mandatory`,`proximity`]}],touch:[{touch:[`auto`,`none`,`manipulation`]}],"touch-x":[{"touch-pan":[`x`,`left`,`right`]}],"touch-y":[{"touch-pan":[`y`,`up`,`down`]}],"touch-pz":[`touch-pinch-zoom`],select:[{select:[`none`,`text`,`all`,`auto`]}],"will-change":[{"will-change":[`auto`,`scroll`,`contents`,`transform`,H,B]}],fill:[{fill:[`none`,...k()]}],"stroke-w":[{stroke:[L,Xe,V,We]}],stroke:[{stroke:[`none`,...k()]}],"forced-color-adjust":[{"forced-color-adjust":[`auto`,`none`]}]},conflictingClassGroups:{"container-named":[`container-type`],overflow:[`overflow-x`,`overflow-y`],overscroll:[`overscroll-x`,`overscroll-y`],inset:[`inset-x`,`inset-y`,`inset-bs`,`inset-be`,`start`,`end`,`top`,`right`,`bottom`,`left`],"inset-x":[`right`,`left`],"inset-y":[`top`,`bottom`],flex:[`basis`,`grow`,`shrink`],gap:[`gap-x`,`gap-y`],p:[`px`,`py`,`ps`,`pe`,`pbs`,`pbe`,`pt`,`pr`,`pb`,`pl`],px:[`pr`,`pl`],py:[`pt`,`pb`],m:[`mx`,`my`,`ms`,`me`,`mbs`,`mbe`,`mt`,`mr`,`mb`,`ml`],mx:[`mr`,`ml`],my:[`mt`,`mb`],size:[`w`,`h`],"font-size":[`leading`],"fvn-normal":[`fvn-ordinal`,`fvn-slashed-zero`,`fvn-figure`,`fvn-spacing`,`fvn-fraction`],"fvn-ordinal":[`fvn-normal`],"fvn-slashed-zero":[`fvn-normal`],"fvn-figure":[`fvn-normal`],"fvn-spacing":[`fvn-normal`],"fvn-fraction":[`fvn-normal`],"line-clamp":[`display`,`overflow`],rounded:[`rounded-s`,`rounded-e`,`rounded-t`,`rounded-r`,`rounded-b`,`rounded-l`,`rounded-ss`,`rounded-se`,`rounded-ee`,`rounded-es`,`rounded-tl`,`rounded-tr`,`rounded-br`,`rounded-bl`],"rounded-s":[`rounded-ss`,`rounded-es`],"rounded-e":[`rounded-se`,`rounded-ee`],"rounded-t":[`rounded-tl`,`rounded-tr`],"rounded-r":[`rounded-tr`,`rounded-br`],"rounded-b":[`rounded-br`,`rounded-bl`],"rounded-l":[`rounded-tl`,`rounded-bl`],"border-spacing":[`border-spacing-x`,`border-spacing-y`],"border-w":[`border-w-x`,`border-w-y`,`border-w-s`,`border-w-e`,`border-w-bs`,`border-w-be`,`border-w-t`,`border-w-r`,`border-w-b`,`border-w-l`],"border-w-x":[`border-w-r`,`border-w-l`],"border-w-y":[`border-w-t`,`border-w-b`],"border-color":[`border-color-x`,`border-color-y`,`border-color-s`,`border-color-e`,`border-color-bs`,`border-color-be`,`border-color-t`,`border-color-r`,`border-color-b`,`border-color-l`],"border-color-x":[`border-color-r`,`border-color-l`],"border-color-y":[`border-color-t`,`border-color-b`],translate:[`translate-x`,`translate-y`,`translate-none`],"translate-none":[`translate`,`translate-x`,`translate-y`,`translate-z`],"scroll-m":[`scroll-mx`,`scroll-my`,`scroll-ms`,`scroll-me`,`scroll-mbs`,`scroll-mbe`,`scroll-mt`,`scroll-mr`,`scroll-mb`,`scroll-ml`],"scroll-mx":[`scroll-mr`,`scroll-ml`],"scroll-my":[`scroll-mt`,`scroll-mb`],"scroll-p":[`scroll-px`,`scroll-py`,`scroll-ps`,`scroll-pe`,`scroll-pbs`,`scroll-pbe`,`scroll-pt`,`scroll-pr`,`scroll-pb`,`scroll-pl`],"scroll-px":[`scroll-pr`,`scroll-pl`],"scroll-py":[`scroll-pt`,`scroll-pb`],touch:[`touch-x`,`touch-y`,`touch-pz`],"touch-x":[`touch`],"touch-y":[`touch`],"touch-pz":[`touch`]},conflictingClassGroupModifiers:{"font-size":[`leading`]},postfixLookupClassGroups:[`container-type`],orderSensitiveModifiers:[`*`,`**`,`after`,`backdrop`,`before`,`details-content`,`file`,`first-letter`,`first-line`,`marker`,`placeholder`,`selection`]}});function G(...e){return dt(T(e))}var K=o();function q({variant:e=`primary`,size:t=`md`,className:n,...r}){return(0,K.jsx)(`button`,{className:G(`inline-flex items-center justify-center gap-2 font-medium transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-40`,t===`sm`&&`h-9 rounded-sm px-3 text-sm`,t===`md`&&`h-10 rounded-md px-4 text-sm`,t===`lg`&&`h-11 rounded-md px-5 text-base`,e===`primary`&&`bg-accent text-accent-fg hover:opacity-90`,e===`ghost`&&`bg-raised text-fg shadow-[var(--shadow-border)] hover:shadow-[var(--shadow-border-hover)]`,e===`paper`&&`bg-paper text-ink hover:opacity-90`,e===`danger`&&`bg-bad/20 text-bad hover:opacity-90`,e===`quiet`&&`text-muted hover:bg-raised hover:text-fg`,n),...r})}function ft({className:e,...t}){return(0,K.jsx)(`input`,{className:G(`h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle`,e),...t})}function pt({className:e,...t}){return(0,K.jsx)(`textarea`,{className:G(`min-h-24 w-full rounded-lg bg-raised px-3 py-2 text-sm text-fg shadow-[var(--shadow-border)] placeholder:text-subtle`,e),...t})}function J({tone:e=`muted`,className:t,...n}){return(0,K.jsx)(`span`,{className:G(`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tabular-nums`,e===`good`&&`bg-good/15 text-good`,e===`warn`&&`bg-warn/15 text-warn`,e===`bad`&&`bg-bad/15 text-bad`,e===`muted`&&`bg-raised text-muted`,e===`accent`&&`bg-accent/15 text-accent`,e===`paper`&&`bg-paper/10 text-paper`,t),...n})}function mt({label:e,hint:t,children:n}){return(0,K.jsxs)(`label`,{className:`grid gap-1.5 text-sm`,children:[(0,K.jsx)(`span`,{className:`font-medium text-fg`,children:e}),n,t?(0,K.jsx)(`span`,{className:`text-xs text-muted`,children:t}):null]})}function ht(e,t,n){let r=t??45,i=Math.min(100,Math.max(0,n))/100,a=e/(r+8)*(1-i*.45);return Math.round(a*10)/10}function gt(e){return e==null?`muted`:e<30?`good`:e<50?`warn`:`bad`}function _t(e,t){return e==null||t==null?0:t-e}function vt(e){return e>=1e6?`${(e/1e6).toFixed(1)}m`:e>=1e3?`${(e/1e3).toFixed(e>=1e4?0:1)}k`:String(e)}function yt(e){return`$${e.toFixed(2)}`}function bt(e,t=72,n=22){if(!e.length)return``;let r=Math.max(...e,1),i=Math.min(...e,0),a=Math.max(r-i,1),o=e.length===1?0:t/(e.length-1);return e.map((e,t)=>{let r=t*o,s=n-(e-i)/a*(n-2)-1;return`${t===0?`M`:`L`}${r.toFixed(1)} ${s.toFixed(1)}`}).join(` `)}function Y(e){let t=ht(e.volume,e.kd,e.ppc);return{id:e.id??e.keywordId,opportunity:t,...e}}var xt=[Y({seed:`field notebook`,keyword:`waterproof field notebook`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:2400,msv:[1800,1900,2100,2e3,2200,2300,2500,2600,2400,2200,2100,2400],kd:18,cpc:1.42,ppc:22,status:`tracked`,lastFetched:`2026-08-27 09:14`,keywordId:`k_wnb_01`,notes:`Hero product term. Brief ready.`,agent:`Assessor`}),Y({seed:`field notebook`,keyword:`best hiking journal`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:1900,msv:[1400,1500,1600,1700,1800,2100,2400,2200,1900,1700,1600,1900],kd:27,cpc:.88,ppc:31,status:`briefed`,lastFetched:`2026-08-27 09:14`,keywordId:`k_hj_02`,notes:`Roundup intent. Seasonal peak Jun–Aug.`,agent:`Brief`}),Y({seed:`field notebook`,keyword:`rugged pocket notebook`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:880,msv:[720,740,760,800,820,860,900,920,880,840,800,880],kd:14,cpc:1.05,ppc:18,status:`new`,lastFetched:`2026-08-27 09:14`,keywordId:`k_rpn_03`,notes:`Easy win. Thin SERP.`,agent:`Scout`}),Y({seed:`trail map`,keyword:`printable trail log`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:590,msv:[400,420,480,520,560,610,680,640,600,540,500,590],kd:11,cpc:.41,ppc:9,status:`new`,lastFetched:`2026-08-26 18:02`,keywordId:`k_ptl_04`,notes:`Lead-magnet candidate.`,agent:`Scout`}),Y({seed:`trail map`,keyword:`national park journal`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:3200,msv:[2100,2300,2500,2800,3100,3600,4200,3900,3400,2900,2500,3200],kd:44,cpc:1.76,ppc:48,status:`ignored`,lastFetched:`2026-08-26 18:02`,keywordId:`k_npj_05`,notes:`Amazon-heavy SERP.`,agent:`Assessor`}),Y({seed:`field notebook`,keyword:`surveyor field book`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:1300,msv:[1200,1250,1280,1300,1320,1290,1270,1260,1280,1310,1300,1300],kd:22,cpc:2.18,ppc:35,status:`tracked`,lastFetched:`2026-08-27 09:14`,keywordId:`k_sfb_06`,notes:`B2B adjacent. High CPC.`,agent:`Rival`}),Y({seed:`outdoor stationery`,keyword:`all weather notebook`,location:`United Kingdom`,locationId:2826,language:`English`,languageId:1e3,volume:720,msv:[500,520,540,580,620,700,780,760,700,640,600,720],kd:19,cpc:.94,ppc:24,status:`new`,lastFetched:`2026-08-25 11:40`,keywordId:`k_awn_07`,notes:`UK volume. Localize packing copy.`,agent:`Expander`}),Y({seed:`outdoor stationery`,keyword:`write in the rain notebook`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:8100,msv:[6200,6400,6800,7200,7600,8400,9100,8800,8200,7600,7200,8100],kd:61,cpc:1.12,ppc:67,status:`ignored`,lastFetched:`2026-08-25 11:40`,keywordId:`k_wir_08`,notes:`Brand-dominated SERP.`,agent:`Assessor`}),Y({seed:`field notebook`,keyword:`geology field notebook`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:480,msv:[450,460,470,480,490,500,510,500,480,470,460,480],kd:9,cpc:.63,ppc:12,status:`briefed`,lastFetched:`2026-08-27 09:14`,keywordId:`k_gfn_09`,notes:`Niche, loyal searchers.`,agent:`Brief`}),Y({seed:`trail map`,keyword:`backcountry trip log template`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:210,msv:[160,170,180,190,200,230,260,250,220,200,180,210],kd:6,cpc:.29,ppc:4,status:`new`,lastFetched:`2026-08-24 08:11`,keywordId:`k_btl_10`,notes:`Template download page.`,agent:`Scout`})],St=[Y({seed:`waterproof field notebook`,keyword:`waterproof notebook for hiking`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:1100,msv:[800,850,900,950,1e3,1200,1400,1300,1100,950,900,1100],kd:16,cpc:1.21,ppc:20,status:`new`,lastFetched:`2026-08-27 09:16`,keywordId:`r_01`,notes:``,agent:`Expander`}),Y({seed:`waterproof field notebook`,keyword:`stone paper notebook`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:1600,msv:[1400,1450,1500,1550,1600,1700,1800,1750,1650,1580,1520,1600],kd:33,cpc:.77,ppc:28,status:`new`,lastFetched:`2026-08-27 09:16`,keywordId:`r_02`,notes:``,agent:`Expander`}),Y({seed:`waterproof field notebook`,keyword:`field notes waterproof`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:2900,msv:[2500,2550,2600,2700,2800,3e3,3200,3100,2900,2700,2600,2900],kd:48,cpc:.54,ppc:41,status:`ignored`,lastFetched:`2026-08-27 09:16`,keywordId:`r_03`,notes:`Competitor brand query.`,agent:`Expander`}),Y({seed:`surveyor field book`,keyword:`engineering field book`,location:`United States`,locationId:2840,language:`English`,languageId:1e3,volume:720,msv:[700,710,720,730,720,710,700,710,720,730,720,720],kd:21,cpc:2.44,ppc:38,status:`new`,lastFetched:`2026-08-27 09:16`,keywordId:`r_04`,notes:``,agent:`Expander`})],Ct=[{id:`t1`,trackingId:`trk_northline_us`,domain:`northline.studio`,keyword:`waterproof field notebook`,location:`United States`,device:`desktop`,rank:7,prev:11,best:6,visits:186,volume:2400,url:`https://northline.studio/notebooks/field`,lastCheck:`2026-08-27 06:02`},{id:`t2`,trackingId:`trk_northline_us`,domain:`northline.studio`,keyword:`surveyor field book`,location:`United States`,device:`desktop`,rank:14,prev:14,best:12,visits:41,volume:1300,url:`https://northline.studio/notebooks/survey`,lastCheck:`2026-08-27 06:02`},{id:`t3`,trackingId:`trk_northline_us`,domain:`northline.studio`,keyword:`geology field notebook`,location:`United States`,device:`mobile`,rank:4,prev:9,best:4,visits:96,volume:480,url:`https://northline.studio/journal/geology`,lastCheck:`2026-08-27 06:02`},{id:`t4`,trackingId:`trk_northline_uk`,domain:`northline.studio`,keyword:`all weather notebook`,location:`United Kingdom`,device:`desktop`,rank:21,prev:18,best:16,visits:12,volume:720,url:`https://northline.studio/notebooks/field`,lastCheck:`2026-08-27 06:04`}],wt=[{id:`c1`,domain:`riteintherain.com`,keyword:`all weather notebook`,volume:8100,kd:61,cpc:1.12,position:1,visitsEst:2400},{id:`c2`,domain:`fieldnotesbrand.com`,keyword:`pocket notebook`,volume:12100,kd:54,cpc:.66,position:2,visitsEst:1800},{id:`c3`,domain:`moleskine.com`,keyword:`national park journal`,volume:3200,kd:44,cpc:1.76,position:3,visitsEst:410},{id:`c4`,domain:`leuchtturm1917.us`,keyword:`hiking journal`,volume:1900,kd:27,cpc:.88,position:5,visitsEst:160}],Tt=[{id:`g1`,keyword:`coastal survey notebook`,volume:320,cpc:1.9,yourPosition:null,competitor:`riteintherain.com`,competitorPosition:4},{id:`g2`,keyword:`forestry field book`,volume:540,cpc:1.55,yourPosition:28,competitor:`riteintherain.com`,competitorPosition:2},{id:`g3`,keyword:`birding life list journal`,volume:880,cpc:.72,yourPosition:null,competitor:`moleskine.com`,competitorPosition:6},{id:`g4`,keyword:`waterproof lab notebook`,volume:410,cpc:2.3,yourPosition:null,competitor:`riteintherain.com`,competitorPosition:3}],Et=[{id:`l1`,name:`Northline — core catalog`,count:18,updated:`2026-08-27`},{id:`l2`,name:`Q3 content briefs`,count:7,updated:`2026-08-22`},{id:`l3`,name:`UK localization`,count:11,updated:`2026-08-19`}],Dt=[{id:`log1`,at:`2026-08-27 09:16`,level:`info`,action:`related-keywords`,detail:`seed=waterproof field notebook · 48 ideas · US/en`,credits:1},{id:`log2`,at:`2026-08-27 09:14`,level:`info`,action:`keyword-imports`,detail:`10 keywords scored`,credits:1},{id:`log3`,at:`2026-08-27 06:04`,level:`info`,action:`serpwatcher.stats`,detail:`trk_northline_uk · 1 keyword`,credits:0},{id:`log4`,at:`2026-08-26 18:02`,level:`warn`,action:`rate-limit`,detail:`429 · backed off 1.6s and retried`,credits:0}],Ot={lookups:{limit:500,remaining:412},serps:{limit:500,remaining:478},tracked:{limit:200,remaining:184},resetHours:11,live:!1},kt=[{id:`scout`,name:`Scout`,job:`Propose seed keywords from a topic, product, or URL.`,uses:`Grok · no Mangools credits`},{id:`expander`,name:`Expander`,job:`Pull related keywords for every seed (up to 700 ideas).`,uses:`GET /kwfinder/related-keywords`},{id:`assessor`,name:`Assessor`,job:`Bulk-score a list: volume, KD, CPC, opportunity, keep/drop.`,uses:`POST /kwfinder/keyword-imports`},{id:`rival`,name:`Rival`,job:`Mine a domain and run gap analysis against 1–5 rivals.`,uses:`competitor-keywords · gap-analysis`},{id:`watch`,name:`Watch`,job:`Create or refresh SERPWatcher trackings and write ranks.`,uses:`SERPWatcher trackings + stats`},{id:`brief`,name:`Brief`,job:`Turn a winning keyword into a content brief on the sheet.`,uses:`Grok · optional SERP lookup`}],At=[{id:0,label:`Global`,country:`—`},{id:2840,label:`United States`,country:`US`},{id:2826,label:`United Kingdom`,country:`GB`},{id:2124,label:`Canada`,country:`CA`},{id:2036,label:`Australia`,country:`AU`},{id:2276,label:`Germany`,country:`DE`},{id:2250,label:`France`,country:`FR`},{id:2724,label:`Spain`,country:`ES`},{id:2380,label:`Italy`,country:`IT`},{id:2528,label:`Netherlands`,country:`NL`},{id:2356,label:`India`,country:`IN`},{id:2076,label:`Brazil`,country:`BR`},{id:2392,label:`Japan`,country:`JP`},{id:2702,label:`Singapore`,country:`SG`},{id:2372,label:`Ireland`,country:`IE`},{id:2554,label:`New Zealand`,country:`NZ`},{id:2484,label:`Mexico`,country:`MX`},{id:2616,label:`Poland`,country:`PL`},{id:2752,label:`Sweden`,country:`SE`},{id:2784,label:`United Arab Emirates`,country:`AE`}],jt=[{id:1e3,code:`en`,label:`English`},{id:1001,code:`de`,label:`German`},{id:1002,code:`es`,label:`Spanish`},{id:1003,code:`fr`,label:`French`},{id:1004,code:`it`,label:`Italian`},{id:1005,code:`pt`,label:`Portuguese`},{id:1006,code:`nl`,label:`Dutch`},{id:1007,code:`ja`,label:`Japanese`},{id:1008,code:`pl`,label:`Polish`},{id:1009,code:`sv`,label:`Swedish`}];function Mt(e){return At.find(t=>t.id===e)?.label??String(e)}function Nt(e){return jt.find(t=>t.id===e)?.label??String(e)}function Pt(e){return e!==`__proto__`&&e!==`constructor`&&e!==`prototype`}function Ft(e,t){let n=Object.create(null);if(e)for(let t of Object.keys(e))Pt(t)&&(n[t]=e[t]);if(t&&typeof t==`object`)for(let e of Object.keys(t))Pt(e)&&(n[e]=t[e]);return n}function It(e){if(!e)return Object.create(null);let t=Object.create(null);for(let n of Object.keys(e))Pt(n)&&(t[n]=e[n]);return t}var Lt=()=>{throw Error(`createServerOnlyFn() functions can only be called on the server!`)},Rt=(e,n)=>{let r=n||e||{};r.method===void 0&&(r.method=`GET`);let i=e=>Rt(void 0,{...r,validator:e,inputValidator:e});return Object.assign(e=>Rt(void 0,{...r,...e}),{options:r,middleware:e=>{let n=[...r.middleware||[]];e.map(e=>{t in e?e.options.middleware&&n.push(...e.options.middleware):n.push(e)});let i=Rt(void 0,{...r,middleware:n});return i[t]=!0,i},validator:i,inputValidator:i,handler:(...e)=>{let[t,n]=e,i={...r,extractedFn:t,serverFn:n},o=[...i.middleware||[],Ht(i)];return t.method=r.method,Object.assign(async e=>{let n=await zt(o,`client`,{...t,...i,data:e?.data,headers:e?.headers,signal:e?.signal,fetch:e?.fetch,context:It()}),r=a(n.error);if(r)throw r;if(n.error)throw n.error;return n.result},{...t,method:r.method,__executeServer:async e=>{let n=Lt(),r=n.contextAfterGlobalMiddlewares;return await zt(o,`server`,{...t,...e,serverFnMeta:t.serverFnMeta,context:Ft(e.context,r),request:n.request}).then(e=>({result:e.result,error:e.error,context:e.sendContext}))}})}})};async function zt(t,n,r){let i=Bt([...s()?.functionMiddleware||[],...t]);if(n===`server`){let e=Lt({throwIfNotFound:!1});e?.executedRequestMiddlewares&&(i=i.filter(t=>!e.executedRequestMiddlewares.has(t)))}let a=async t=>{let r=i.shift();if(!r)return t;try{let i=`validator`in r.options?r.options.validator:void 0;!i&&`inputValidator`in r.options&&(i=r.options.inputValidator),i&&n===`server`&&(t.data=await Vt(i,t.data));let o;if(n===`client`?`client`in r.options&&(o=r.options.client):`server`in r.options&&(o=r.options.server),o){let n=async(e={})=>{let n=await a({...t,...e,context:Ft(t.context,e.context),sendContext:Ft(t.sendContext,e.sendContext),headers:ee(t.headers,e.headers),_callSiteFetch:t._callSiteFetch,fetch:t._callSiteFetch??e.fetch??t.fetch,result:e.result===void 0?e instanceof Response?e:t.result:e.result,error:e.error??t.error});if(n.error)throw n.error;return n},r=await o({...t,next:n});if(e(r))return{...t,error:r};if(r instanceof Response)return{...t,result:r};if(!r)throw Error(`User middleware returned undefined. You must call next() or return a result in your middlewares.`);return r}return a(t)}catch(e){return{...t,error:e}}};return a({...r,headers:r.headers||{},sendContext:r.sendContext||{},context:r.context||It(),_callSiteFetch:r.fetch})}function Bt(e,t=100){let n=new Set,r=[],i=(e,a)=>{if(a>t)throw Error(`Middleware nesting depth exceeded maximum of ${t}. Check for circular references.`);e.forEach(e=>{e.options.middleware&&i(e.options.middleware,a+1),n.has(e)||(n.add(e),r.push(e))})};return i(e,0),r}async function Vt(e,t){if(e==null)return{};if(`~standard`in e){let n=await e[`~standard`].validate(t);if(n.issues)throw Error(JSON.stringify(n.issues,void 0,2));return n.value}if(`parse`in e)return e.parse(t);if(typeof e==`function`)return e(t);throw Error(`Invalid validator type!`)}function Ht(e){return{"~types":void 0,options:{inputValidator:e.validator??e.inputValidator,client:async({next:t,sendContext:n,fetch:r,...i})=>{let a={...i,context:n,fetch:r};return t(await e.extractedFn?.(a))},server:async({next:t,...n})=>{let r=await e.serverFn?.(n);return t({...n,result:r})}}}}var Ut=Rt({method:`POST`}).handler(n(`5b738a0d7db0c8f22a3da300c948d1433c0c697de7162b763d83c97c20e8bc9b`)),Wt=e=>{let t,n=new Set,r=(e,r)=>{let i=typeof e==`function`?e(t):e;if(!Object.is(i,t)){let e=t;t=r??(typeof i!=`object`||!i)?i:Object.assign({},t,i),n.forEach(n=>n(t,e))}},i=()=>t,a={setState:r,getState:i,getInitialState:()=>o,subscribe:e=>(n.add(e),()=>n.delete(e))},o=t=e(r,i,a);return a},Gt=(e=>e?Wt(e):Wt),X=l(r(),1),Kt=e=>e;function qt(e,t=Kt){let n=X.useSyncExternalStore(e.subscribe,X.useCallback(()=>t(e.getState()),[e,t]),X.useCallback(()=>t(e.getInitialState()),[e,t]));return X.useDebugValue(n),n}var Jt=e=>{let t=Gt(e),n=e=>qt(t,e);return Object.assign(n,t),n},Yt=(e=>e?Jt(e):Jt);function Xt(e,t){let n;try{n=e()}catch{return}return{getItem:e=>{let r=e=>e===null?null:JSON.parse(e,t?.reviver),i=n.getItem(e)??null;return i instanceof Promise?i.then(r):r(i)},setItem:(e,r)=>n.setItem(e,JSON.stringify(r,t?.replacer)),removeItem:e=>n.removeItem(e)}}var Zt=e=>t=>{try{let n=e(t);return n instanceof Promise?n:{then(e){return Zt(e)(n)},catch(e){return this}}}catch(e){return{then(e){return this},catch(t){return Zt(t)(e)}}}},Qt=(e,t)=>(n,r,i)=>{let a={storage:Xt(()=>window.localStorage),partialize:e=>e,version:0,merge:(e,t)=>({...t,...e}),...t},o=!1,s=0,c=new Set,l=new Set,u=a.storage;if(!u)return e((...e)=>{console.warn(`[zustand persist middleware] Unable to update item '${a.name}', the given storage is currently unavailable.`),n(...e)},r,i);let d=()=>{let e=a.partialize({...r()});return u.setItem(a.name,{state:e,version:a.version})},ee=i.setState;i.setState=(e,t)=>(ee(e,t),d());let f=e((...e)=>(n(...e),d()),r,i);i.getInitialState=()=>f;let p,m=()=>{if(!u)return;let e=++s;o=!1,c.forEach(e=>e(r()??f));let t=a.onRehydrateStorage?.call(a,r()??f)||void 0;return Zt(u.getItem.bind(u))(a.name).then(e=>{if(e){if(typeof e.version==`number`&&e.version!==a.version){if(a.migrate){let t=a.migrate(e.state,e.version);return t instanceof Promise?t.then(e=>[!0,e]):[!0,t]}console.error(`State loaded from storage couldn't be migrated since no migrate function was provided`)}else return[!1,e.state]}return[!1,void 0]}).then(t=>{if(e!==s)return;let[i,o]=t;if(p=a.merge(o,r()??f),n(p,!0),i)return d()}).then(()=>{e===s&&(t?.(r(),void 0),p=r(),o=!0,l.forEach(e=>e(p)))}).catch(n=>{e===s&&t?.(void 0,n)})};return i.persist={setOptions:e=>{a={...a,...e},e.storage&&(u=e.storage)},clearStorage:()=>{++s,u?.removeItem(a.name)},getOptions:()=>a,rehydrate:()=>m(),hasHydrated:()=>o,onHydrate:e=>(c.add(e),()=>{c.delete(e)}),onFinishHydration:e=>(l.add(e),()=>{l.delete(e)})},a.skipHydration||m(),p||f},$t={apiKey:``,domain:`northline.studio`,locationId:2840,languageId:1e3,trackingId:``,llmKey:``,llmBase:`https://api.x.ai/v1`,webhookSecret:``,dailyTrigger:!0};function en(){return Math.random().toString(36).slice(2,10)}var Z=Yt()(Qt((e,t)=>({view:`workspace`,sheetTab:`keywords`,settings:$t,keywords:xt,related:St,tracking:Ct,competitors:wt,gaps:Tt,lists:Et,log:Dt,quota:Ot,selected:[],messages:[{id:`welcome`,role:`assistant`,at:new Date().toISOString(),content:`I run Canopy's research desk. Give me a topic, a domain, or a sheet goal and I will draft seeds, score opportunities, and write the agent playbook your Google Sheet will execute against Mangools.`,playbook:null}],setView:t=>e({view:t}),setSheetTab:t=>e({sheetTab:t}),patchSettings:n=>e({settings:{...t().settings,...n}}),setKeywords:t=>e({keywords:t}),mergeKeywords:n=>{let r=new Map(t().keywords.map(e=>[e.keyword.toLowerCase(),e]));for(let e of n)r.set(e.keyword.toLowerCase(),e);e({keywords:[...r.values()]})},setRelated:t=>e({related:t}),setTracking:t=>e({tracking:t}),setCompetitors:t=>e({competitors:t}),setGaps:t=>e({gaps:t}),setLists:t=>e({lists:t}),setQuota:t=>e({quota:t}),addLog:n=>e({log:[{...n,id:en()},...t().log].slice(0,80)}),toggleSelected:n=>{let r=t().selected;e({selected:r.includes(n)?r.filter(e=>e!==n):[...r,n]})},clearSelected:()=>e({selected:[]}),addMessage:n=>e({messages:[...t().messages,{...n,id:en(),at:new Date().toISOString()}]}),updateStatus:(n,r)=>e({keywords:t().keywords.map(e=>e.id===n?{...e,status:r}:e)}),addSeeds:n=>{let r=new Set(t().keywords.map(e=>e.keyword.toLowerCase())),{settings:i}=t(),a=n.map(e=>e.trim()).filter(e=>e&&!r.has(e.toLowerCase())).map(e=>({id:en(),seed:e,keyword:e,location:`United States`,locationId:i.locationId,language:`English`,languageId:i.languageId,volume:0,msv:[],kd:null,cpc:0,ppc:0,opportunity:ht(0,null,0),status:`new`,lastFetched:`—`,keywordId:``,notes:`Added by agent`,agent:`Scout`}));a.length&&e({keywords:[...a,...t().keywords]})},resetDemo:()=>e({keywords:xt,related:St,tracking:Ct,competitors:wt,gaps:Tt,lists:Et,log:Dt,quota:Ot,selected:[]})}),{name:`canopy-ledger`,skipHydration:!0,partialize:e=>({settings:e.settings,keywords:e.keywords,related:e.related,tracking:e.tracking,competitors:e.competitors,gaps:e.gaps,lists:e.lists,log:e.log,messages:e.messages.slice(-24)})}));function tn(){let e=Z(e=>e.messages),t=Z(e=>e.addMessage),n=Z(e=>e.addSeeds),r=Z(e=>e.setView),i=Z(e=>e.keywords),a=Z(e=>e.settings),[o,s]=(0,X.useState)(`Map a 90-day content plan for waterproof field notebooks in the US.`),[l,u]=(0,X.useState)(!1);async function d(){let e=o.trim();if(!(!e||l)){t({role:`user`,content:e}),s(``),u(!0);try{let n=i.slice(0,12).map(e=>`${e.keyword} (vol ${e.volume}, kd ${e.kd??`—`})`).join(`
`),r=await Ut({data:{message:e,domain:a.domain,location:Mt(a.locationId),keywordsPreview:n}});if(!r.ok){t({role:`assistant`,content:r.error}),c.error(r.error);return}t({role:`assistant`,content:r.reply,playbook:r.playbook})}catch(e){let n=e instanceof Error?e.message:`Agent failed`;t({role:`assistant`,content:n}),c.error(n)}finally{u(!1)}}}return(0,K.jsxs)(`div`,{className:`grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]`,children:[(0,K.jsxs)(`section`,{className:`flex min-h-0 flex-col`,children:[(0,K.jsx)(`p`,{className:`text-xs font-medium uppercase tracking-widest text-muted`,children:`Desk`}),(0,K.jsx)(`h1`,{className:`font-display text-3xl font-medium tracking-tight sm:text-4xl`,children:`Research agents`}),(0,K.jsx)(`p`,{className:`mt-1 max-w-2xl text-sm text-muted`,children:`Grok plans the run. The Google Sheet executes it against Mangools on a trigger or via the web app webhook your other agents can POST to.`}),(0,K.jsxs)(`div`,{className:`mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]`,children:[(0,K.jsxs)(`div`,{className:`flex-1 space-y-4 overflow-auto px-1 py-2`,children:[e.map(e=>(0,K.jsxs)(`article`,{className:e.role===`user`?`ml-8 rounded-xl rounded-tr-sm bg-raised px-4 py-3 text-sm`:`mr-4 rounded-xl rounded-tl-sm bg-bg px-4 py-3 text-sm shadow-[var(--shadow-border)]`,children:[(0,K.jsx)(`p`,{className:`whitespace-pre-wrap text-pretty`,children:e.content}),e.playbook?(0,K.jsx)(nn,{playbook:e.playbook,onApply:()=>{n(e.playbook.seeds),c.success(`Seeds written to the Keywords sheet`),r(`workspace`)}}):null]},e.id)),l?(0,K.jsxs)(`p`,{className:`flex items-center gap-2 text-sm text-muted`,children:[(0,K.jsx)(S,{className:`size-4 animate-spin`}),`Drafting playbook`]}):null]}),(0,K.jsxs)(`form`,{className:`mt-2 flex flex-col gap-2 sm:flex-row sm:items-end`,onSubmit:e=>{e.preventDefault(),d()},children:[(0,K.jsx)(pt,{value:o,onChange:e=>s(e.target.value),onKeyDown:e=>{e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),d())},placeholder:`Topic, domain, or a job for the sheet`,className:`min-h-20 flex-1`}),(0,K.jsxs)(q,{type:`submit`,disabled:l||!o.trim(),className:`h-11 shrink-0`,children:[(0,K.jsx)(w,{className:`size-4`}),`Run`]})]})]})]}),(0,K.jsx)(`aside`,{className:`grid h-fit gap-3`,children:kt.map(e=>(0,K.jsxs)(`div`,{className:`rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]`,children:[(0,K.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,K.jsx)(`h2`,{className:`font-display text-lg font-medium`,children:e.name}),(0,K.jsx)(J,{children:e.id})]}),(0,K.jsx)(`p`,{className:`mt-1 text-sm text-muted`,children:e.job}),(0,K.jsx)(`p`,{className:`mt-2 font-mono text-xs text-subtle`,children:e.uses})]},e.id))})]})}function nn({playbook:e,onApply:t}){return(0,K.jsxs)(`div`,{className:`mt-3 rounded-lg bg-raised p-3`,children:[(0,K.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,K.jsx)(`h3`,{className:`font-display text-base font-medium`,children:e.title}),(0,K.jsx)(q,{size:`sm`,onClick:t,children:`Write seeds to sheet`})]}),(0,K.jsx)(`p`,{className:`mt-1 text-sm text-muted`,children:e.summary}),e.seeds?.length?(0,K.jsx)(`ul`,{className:`mt-2 flex flex-wrap gap-1.5`,children:e.seeds.map(e=>(0,K.jsx)(`li`,{children:(0,K.jsx)(J,{tone:`accent`,children:e})},e))}):null,e.tasks?.length?(0,K.jsx)(`ol`,{className:`mt-3 space-y-1.5 text-sm`,children:e.tasks.map((e,t)=>(0,K.jsxs)(`li`,{className:`flex gap-2`,children:[(0,K.jsx)(`span`,{className:`w-16 shrink-0 font-medium text-accent`,children:e.agent}),(0,K.jsxs)(`span`,{className:`text-muted`,children:[e.action,` — `,e.input]})]},t))}):null,e.notes?(0,K.jsx)(`p`,{className:`mt-2 text-xs text-subtle`,children:e.notes}):null]})}var rn=[{method:`GET`,path:`/kwfinder/related-keywords`,name:`Related keywords`,group:`KWFinder`,credits:`1 keyword lookup (24h cache)`,params:[{name:`kw`,required:!0,hint:`Seed keyword`},{name:`location_id`,required:!1,hint:`Default 0 (global)`},{name:`language_id`,required:!1,hint:`Default 0`}],notes:`Up to ~700 related ideas with volume, CPC, PPC, monthly history. KD is often cached/null until a SERP lookup.`,sheet:`Related`},{method:`POST`,path:`/kwfinder/keyword-imports`,name:`Bulk keyword details`,group:`KWFinder`,credits:`1 lookup per unique set (24h cache)`,params:[{name:`keywords`,required:!0,hint:`Up to 700 strings`},{name:`location_id`,required:!0,hint:`e.g. 2840 US`},{name:`language_id`,required:!0,hint:`e.g. 1000 English`}],body:`{ "keywords": ["seo agency","seo"], "location_id": 2840, "language_id": 1000 }`,notes:`Most powerful research endpoint. Import your own list and get sv, cpc, ppc, msv, seo difficulty.`,sheet:`Keywords`},{method:`GET`,path:`/kwfinder/competitor-keywords`,name:`Competitor keywords`,group:`KWFinder`,credits:`1 keyword lookup`,params:[{name:`url`,required:!0,hint:`Domain, subdomain, or URL`},{name:`location_id`,required:!0,hint:`Country id (default 2840)`}],notes:`Keywords a domain ranks for, sorted by estimated organic impact. Up to 1,000 rows. POST variant exists for the same path.`,sheet:`Competitors`},{method:`POST`,path:`/kwfinder/competitor-keywords`,name:`Competitor keywords (POST)`,group:`KWFinder`,credits:`1 keyword lookup`,params:[{name:`url`,required:!0,hint:`Domain in JSON body`},{name:`location_id`,required:!0,hint:`Country id`}],body:`{ "url": "example.com", "location_id": 2840 }`,notes:`Use POST when the URL is awkward as a query string.`,sheet:`Competitors`},{method:`POST`,path:`/kwfinder/gap-analysis`,name:`Keyword gap analysis`,group:`KWFinder`,credits:`1 keyword lookup`,params:[{name:`domain`,required:!0,hint:`Your domain`},{name:`competitors`,required:!0,hint:`1–5 competitor domains`},{name:`location_id`,required:!0,hint:`Location id`},{name:`page`,required:!1,hint:`Premium/Agency pagination`}],body:`{ "domain": "yoursite.com", "competitors": ["a.com","b.com"], "location_id": 2840 }`,notes:`Keywords they rank for that you don't. Sorted by opportunity.`,sheet:`Gaps`},{method:`GET`,path:`/kwfinder/suggested-keywords`,name:`Suggested keywords for URL`,group:`KWFinder`,credits:`1 keyword lookup`,params:[{name:`url`,required:!0,hint:`Page or domain URL`}],notes:`Ranking-keyword suggestions for a URL. Useful when spinning up a SERPWatcher tracking.`,sheet:`Keywords`},{method:`GET`,path:`/kwfinder/competitor-domain`,name:`Competitor domains`,group:`KWFinder`,credits:`1 keyword lookup`,params:[{name:`kw`,required:!0,hint:`Keyword to find competing domains for`}],notes:`Who ranks in the neighborhood of a keyword.`,sheet:`Competitors`},{method:`GET`,path:`/kwfinder/trends`,name:`Search volume trends`,group:`KWFinder`,credits:`trends quota`,params:[{name:`kw`,required:!0,hint:`Keyword`}],notes:`Legacy. New integrations should use msv from keyword-imports.`,sheet:`Keywords`},{method:`GET`,path:`/kwfinder/kd/url-metrics`,name:`URL metrics for KD`,group:`KWFinder`,credits:`kw-url-metrics`,params:[{name:`url`,required:!0,hint:`URL to score`}],notes:`Compute SEO difficulty inputs for a specific URL.`,sheet:`SERP`},{method:`GET`,path:`/kwfinder/kd/requests`,name:`KD lookup history`,group:`KWFinder`,credits:`none`,params:[],notes:`Recent KD computations for the account.`,sheet:`Log`},{method:`POST`,path:`/kwfinder/keywords`,name:`Export keywords CSV`,group:`KWFinder`,credits:`none extra`,params:[{name:`keyword_ids`,required:!0,hint:`IDs from prior lookups (_id)`}],body:`{ "keyword_ids": ["11e2a4ff…"], "fields": "kw,sv,cpc,ppc,seo,msv" }`,notes:`CSV export of previously fetched keyword ids.`,sheet:`Keywords`},{method:`GET`,path:`/kwfinder/lists`,name:`List all keyword lists`,group:`KWFinder`,credits:`none`,params:[],notes:`Saved KWFinder lists on the account.`,sheet:`Lists`},{method:`POST`,path:`/kwfinder/lists`,name:`Create keyword list`,group:`KWFinder`,credits:`none`,params:[{name:`name`,required:!0,hint:`List name`}],body:`{ "name": "Q3 content" }`,notes:`Create a list, then add keywords via /lists/{id}/keyword.`,sheet:`Lists`},{method:`GET`,path:`/kwfinder/lists/{list_id}`,name:`Get list items`,group:`KWFinder`,credits:`none`,params:[{name:`list_id`,required:!0,hint:`Path id`}],notes:`Keywords saved in a list.`,sheet:`Lists`},{method:`PATCH`,path:`/kwfinder/lists/{list_id}`,name:`Rename list`,group:`KWFinder`,credits:`none`,params:[{name:`name`,required:!0,hint:`New name`}],notes:`Update list metadata.`,sheet:`Lists`},{method:`DELETE`,path:`/kwfinder/lists/{list_id}`,name:`Delete list`,group:`KWFinder`,credits:`none`,params:[{name:`list_id`,required:!0,hint:`Path id`}],notes:`Remove a custom list.`,sheet:`Lists`},{method:`POST`,path:`/kwfinder/lists/{list_id}/keyword`,name:`Add keywords to list`,group:`KWFinder`,credits:`none`,params:[{name:`keywords`,required:!0,hint:`One or more keywords`}],notes:`Append keywords to an existing list.`,sheet:`Lists`},{method:`DELETE`,path:`/kwfinder/lists/{list_id}/keyword`,name:`Remove keywords from list`,group:`KWFinder`,credits:`none`,params:[{name:`keywords`,required:!0,hint:`Keywords to drop`}],notes:`Remove selected keywords from a list.`,sheet:`Lists`},{method:`GET`,path:`/serpchecker/serps`,name:`SERP results + live KD`,group:`SERPChecker`,credits:`1 SERP lookup`,params:[{name:`kw`,required:!0,hint:`Keyword`},{name:`location_id`,required:!1,hint:`Local SERP`},{name:`language_id`,required:!1,hint:`Language`}],notes:`Organic results, SERP features, CTR, result count. Recomputes keyword difficulty in real time.`,sheet:`SERP`},{method:`GET`,path:`/serpchecker/serps/{serp_id}/snapshot`,name:`SERP snapshot`,group:`SERPChecker`,credits:`none extra`,params:[{name:`serp_id`,required:!0,hint:`From a prior SERP call`}],notes:`Historical snapshot of a fetched SERP.`,sheet:`SERP`},{method:`GET`,path:`/serpchecker/url-metrics`,name:`Moz / Majestic URL metrics`,group:`SERPChecker`,credits:`sch-url-metrics`,params:[{name:`url`,required:!0,hint:`URL to inspect`}],notes:`Authority metrics used when scoring SERP difficulty.`,sheet:`SERP`},{method:`GET`,path:`/serpwatcher/trackings`,name:`List trackings`,group:`SERPWatcher`,credits:`none`,params:[],notes:`All rank-tracking projects on the account.`,sheet:`Tracking`},{method:`POST`,path:`/serpwatcher/trackings`,name:`Create tracking`,group:`SERPWatcher`,credits:`tracked keyword quota`,params:[{name:`domain`,required:!0,hint:`Site to track`},{name:`location_id`,required:!0,hint:`Rank location`},{name:`platform_id`,required:!0,hint:`1 desktop, 2 mobile`},{name:`keywords`,required:!0,hint:`Keywords to watch`}],body:`{ "domain": "example.com", "location_id": 2840, "platform_id": 1, "keywords": ["rank tracking api"] }`,notes:`Creates a SERPWatcher project. Consumes tracked-keyword quota on paid plans.`,sheet:`Tracking`},{method:`POST`,path:`/serpwatcher/multiple-trackings`,name:`Create trackings in bulk`,group:`SERPWatcher`,credits:`tracked keyword quota`,params:[{name:`trackings`,required:!0,hint:`Array of tracking payloads`}],notes:`Batch create projects (locations × devices).`,sheet:`Tracking`},{method:`GET`,path:`/serpwatcher/trackings/{id}/detail`,name:`Tracking detail + keywords`,group:`SERPWatcher`,credits:`none`,params:[{name:`tracking_id`,required:!0,hint:`Path id`}],notes:`Full project with current keyword set.`,sheet:`Tracking`},{method:`POST`,path:`/serpwatcher/trackings/{id}/stats`,name:`Ranking stats over time`,group:`SERPWatcher`,credits:`none`,params:[{name:`tracking_id`,required:!0,hint:`Path id`},{name:`from`,required:!1,hint:`Start date`},{name:`to`,required:!1,hint:`End date`}],notes:`Current / best / average rank, rank change, estimated visits, sampled history.`,sheet:`Tracking`},{method:`PUT`,path:`/serpwatcher/trackings/{id}`,name:`Update tracking`,group:`SERPWatcher`,credits:`none`,params:[{name:`domain`,required:!1,hint:`New domain`},{name:`location_id`,required:!1,hint:`New location`}],notes:`Change domain or location of an existing project.`,sheet:`Tracking`},{method:`DELETE`,path:`/serpwatcher/trackings/{id}`,name:`Delete tracking`,group:`SERPWatcher`,credits:`none`,params:[{name:`tracking_id`,required:!0,hint:`Path id`}],notes:`Remove a project.`,sheet:`Tracking`},{method:`GET`,path:`/serpwatcher/trackings/{id}/tracked-keywords`,name:`List tracked keywords`,group:`SERPWatcher`,credits:`none`,params:[{name:`tracking_id`,required:!0,hint:`Path id`}],notes:`Keywords currently watched in a project.`,sheet:`Tracking`},{method:`POST`,path:`/serpwatcher/trackings/{id}/tracked-keywords`,name:`Add tracked keywords`,group:`SERPWatcher`,credits:`tracked keyword quota`,params:[{name:`keywords`,required:!0,hint:`Keywords to add`}],notes:`Append keywords to a live tracking.`,sheet:`Tracking`},{method:`DELETE`,path:`/serpwatcher/trackings/{id}/tracked-keywords`,name:`Remove tracked keywords`,group:`SERPWatcher`,credits:`none`,params:[{name:`keywords`,required:!0,hint:`Keywords to drop`}],notes:`Stop watching selected keywords.`,sheet:`Tracking`},{method:`GET`,path:`/serpwatcher/trackings/{id}/reports`,name:`List reports`,group:`SERPWatcher`,credits:`none`,params:[],notes:`Scheduled/shareable ranking reports.`,sheet:`Tracking`},{method:`POST`,path:`/serpwatcher/trackings/{id}/annotations`,name:`Add annotation`,group:`SERPWatcher`,credits:`none`,params:[{name:`text`,required:!0,hint:`Note, e.g. 'published guide'`}],notes:`Pin an event on the rank chart (content ship, links, algorithm).`,sheet:`Tracking`},{method:`GET`,path:`/serpwatcher/tags`,name:`List tags`,group:`SERPWatcher`,credits:`none`,params:[],notes:`Account-level tags for organizing trackings.`,sheet:`Tracking`},{method:`GET`,path:`/kwfinder/limits`,name:`Quota and remaining credits`,group:`Quota`,credits:`none`,params:[],notes:`Keyword lookups, SERPs, tracked keywords, backlink rows, short-period rate (often 3 reqs). Duplicate lookups within 24h do not recount.`,sheet:`Quota`},{method:`GET`,path:`/mangools/locations`,name:`Search locations`,group:`Locations`,credits:`none`,params:[{name:`query`,required:!1,hint:`City, region, or country`}],notes:`Resolve location_id for local volume and ranks. City-level targeting is supported.`,sheet:`Locations`},{method:`GET`,path:`/mangools/locations/{location}`,name:`Location detail`,group:`Locations`,credits:`none`,params:[{name:`location`,required:!0,hint:`Location id`}],notes:`Canonical name, country code, google_domain.`,sheet:`Locations`}],an=[{key:`kw`,label:`Keyword`,meaning:`The query string`},{key:`_id`,label:`Keyword ID`,meaning:`Mangools id — reuse for CSV export and lists`},{key:`sv`,label:`Avg. search volume`,meaning:`Average monthly searches`},{key:`svn`,label:`Normalized volume`,meaning:`Normalized / current volume figure`},{key:`svs`,label:`Volume (alt)`,meaning:`Secondary volume field from some endpoints`},{key:`msv`,label:`Monthly history`,meaning:`Array: often [year, month, volume] triples or monthly series`},{key:`cpc`,label:`CPC`,meaning:`Cost per click in the location's currency, often USD`},{key:`ppc`,label:`PPC competition`,meaning:`Paid competition 0–100`},{key:`seo`,label:`Keyword difficulty`,meaning:`Cached KD 0–100. Null until SERP/KD compute`},{key:`seo_ts`,label:`KD timestamp`,meaning:`When KD was last computed`},{key:`lid`,label:`Location id`,meaning:`Geotarget of this keyword row`},{key:`ts`,label:`Fetched at`,meaning:`Unix timestamp of the metric snapshot`},{key:`h`,label:`History tuples`,meaning:`Competitor-keyword history: volume, KD, PPC, timestamps, CPC`}],on=[`Identical requests inside 24 hours are served from cache and do not recount toward keyword lookups.`,`Burst limit is small (reqs-per-short-period is often 3). Canopy sleeps and retries 429s with exponential backoff.`,`Apps Script executions cap at 6 minutes. The script chunks work and stores a continuation token.`,`Bulk import accepts at most 700 keywords per request.`,`Creating SERPWatcher trackings consumes tracked-keyword quota on paid plans.`,`Get a key at mangools.com/api-token and send it as the X-Access-Token header. Never put it in the URL.`],sn=[`All`,`KWFinder`,`SERPChecker`,`SERPWatcher`,`Locations`,`Quota`];function cn(){let[e,t]=(0,X.useState)(``),[n,r]=(0,X.useState)(`All`),i=(0,X.useMemo)(()=>rn.filter(t=>n!==`All`&&t.group!==n?!1:!e.trim()||`${t.name} ${t.path} ${t.notes}`.toLowerCase().includes(e.toLowerCase())),[e,n]);return(0,K.jsxs)(`div`,{className:`flex flex-1 flex-col gap-5`,children:[(0,K.jsxs)(`div`,{children:[(0,K.jsx)(`p`,{className:`text-xs font-medium uppercase tracking-widest text-muted`,children:`Reference`}),(0,K.jsx)(`h1`,{className:`font-display text-3xl font-medium tracking-tight sm:text-4xl`,children:`Mangools API`}),(0,K.jsxs)(`p`,{className:`mt-1 max-w-2xl text-sm text-muted`,children:[`Base URL `,(0,K.jsx)(`code`,{className:`font-mono text-accent`,children:`https://api.mangools.com/v3`}),`. Header `,(0,K.jsx)(`code`,{className:`font-mono text-accent`,children:`X-Access-Token`}),`. Every endpoint the workbook implements, plus the metric dictionary.`]})]}),(0,K.jsxs)(`div`,{className:`flex flex-col gap-3 sm:flex-row sm:items-center`,children:[(0,K.jsx)(ft,{value:e,onChange:e=>t(e.target.value),placeholder:`Filter endpoints`,className:`sm:max-w-sm`}),(0,K.jsx)(`div`,{className:`flex flex-wrap gap-1`,children:sn.map(e=>(0,K.jsx)(`button`,{type:`button`,onClick:()=>r(e),className:G(`h-9 rounded-md px-3 text-sm`,n===e?`bg-accent text-accent-fg`:`bg-raised text-muted`),children:e},e))})]}),(0,K.jsx)(`div`,{className:`grid gap-3 lg:grid-cols-2`,children:i.map(e=>(0,K.jsxs)(`article`,{className:`rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]`,children:[(0,K.jsxs)(`div`,{className:`flex flex-wrap items-center gap-2`,children:[(0,K.jsx)(J,{tone:e.method===`GET`?`accent`:`warn`,children:e.method}),(0,K.jsx)(`code`,{className:`font-mono text-xs text-muted`,children:e.path}),(0,K.jsx)(J,{className:`ml-auto`,tone:`muted`,children:e.sheet})]}),(0,K.jsx)(`h2`,{className:`mt-2 font-display text-xl font-medium`,children:e.name}),(0,K.jsx)(`p`,{className:`mt-1 text-sm text-muted`,children:e.notes}),(0,K.jsxs)(`p`,{className:`mt-2 text-xs text-subtle`,children:[`Credits: `,e.credits]}),(0,K.jsx)(`ul`,{className:`mt-3 space-y-1 text-sm`,children:e.params.map(e=>(0,K.jsxs)(`li`,{className:`flex gap-2`,children:[(0,K.jsxs)(`code`,{className:`w-28 shrink-0 font-mono text-xs text-accent`,children:[e.name,e.required?``:`?`]}),(0,K.jsx)(`span`,{className:`text-muted`,children:e.hint})]},e.name))}),e.body?(0,K.jsx)(`pre`,{className:`mt-3 overflow-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted`,children:e.body}):null]},e.method+e.path))}),(0,K.jsxs)(`section`,{className:`rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]`,children:[(0,K.jsx)(`h2`,{className:`font-display text-xl font-medium`,children:`Response fields`}),(0,K.jsx)(`div`,{className:`mt-3 overflow-auto`,children:(0,K.jsxs)(`table`,{className:`w-full min-w-[520px] text-left text-sm`,children:[(0,K.jsx)(`thead`,{className:`text-muted`,children:(0,K.jsxs)(`tr`,{children:[(0,K.jsx)(`th`,{className:`py-2 font-medium`,children:`Key`}),(0,K.jsx)(`th`,{className:`py-2 font-medium`,children:`Sheet column`}),(0,K.jsx)(`th`,{className:`py-2 font-medium`,children:`Meaning`})]})}),(0,K.jsx)(`tbody`,{children:an.map(e=>(0,K.jsxs)(`tr`,{className:`border-t border-border`,children:[(0,K.jsx)(`td`,{className:`py-2 font-mono text-xs text-accent`,children:e.key}),(0,K.jsx)(`td`,{className:`py-2`,children:e.label}),(0,K.jsx)(`td`,{className:`py-2 text-muted`,children:e.meaning})]},e.key))})]})})]}),(0,K.jsxs)(`section`,{className:`rounded-2xl bg-raised p-5`,children:[(0,K.jsx)(`h2`,{className:`font-display text-xl font-medium`,children:`Rate limits & credits`}),(0,K.jsx)(`ul`,{className:`mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2`,children:on.map(e=>(0,K.jsx)(`li`,{className:`rounded-lg bg-bg/50 px-3 py-2`,children:e},e))})]})]})}var ln=`/**
 * CANOPY — Mangools × Google Sheets
 * ---------------------------------
 * Keyword research, rank tracking, list sync, and AI-agent automation
 * against the Mangools REST API (KWFinder, SERPChecker, SERPWatcher).
 *
 * Install: Extensions → Apps Script → paste this file + appsscript.json
 *          → Save → reload the spreadsheet → Canopy menu → Setup workbook.
 *
 * Auth:    Script Properties key MANGOOLS_API_KEY  (X-Access-Token)
 * Docs:    https://apidocs.mangools.com/
 * Token:   https://mangools.com/api-token
 *
 * Web app: Deploy → New deployment → Web app. Your AI agents POST JSON
 *          with { secret, action, payload } to drive this workbook.
 */

var CANOPY = {
  BASE: 'https://api.mangools.com/v3',
  MAX_BULK: 700,
  SHORT_PAUSE_MS: 450,
  MAX_RETRIES: 5,
  EXEC_BUDGET_MS: 5 * 60 * 1000,
  SHEETS: {
    SETTINGS: 'Settings',
    KEYWORDS: 'Keywords',
    RELATED: 'Related',
    TRACKING: 'Tracking',
    COMPETITORS: 'Competitors',
    GAPS: 'Gaps',
    SERP: 'SERP',
    LISTS: 'Lists',
    AGENTS: 'Agents',
    LOCATIONS: 'Locations',
    QUOTA: 'Quota',
    LOG: 'Log'
  }
};

/* ------------------------------------------------------------------ */
/*  Menu                                                              */
/* ------------------------------------------------------------------ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Canopy')
    .addItem('Setup workbook', 'canopySetup')
    .addItem('Save API key…', 'canopyPromptApiKey')
    .addItem('Check quota', 'canopyRefreshQuota')
    .addSeparator()
    .addItem('Score selected / Keywords sheet (bulk import)', 'canopyBulkImport')
    .addItem('Expand related keywords', 'canopyRelated')
    .addItem('Fetch SERP + live KD', 'canopySerp')
    .addSeparator()
    .addItem('Competitor keywords', 'canopyCompetitorKeywords')
    .addItem('Keyword gap analysis', 'canopyGapAnalysis')
    .addItem('Suggested keywords for URL', 'canopySuggested')
    .addSeparator()
    .addItem('Refresh rank tracking', 'canopyRefreshTracking')
    .addItem('Create tracking from Keywords', 'canopyCreateTracking')
    .addItem('Sync KWFinder lists', 'canopySyncLists')
    .addItem('Search locations…', 'canopySearchLocations')
    .addSeparator()
    .addItem('Run due agent tasks', 'canopyRunAgents')
    .addItem('Install daily trigger', 'canopyInstallTriggers')
    .addItem('Remove triggers', 'canopyRemoveTriggers')
    .addToUi();
}

function onInstall(e) {
  onOpen();
}

/* ------------------------------------------------------------------ */
/*  Setup                                                             */
/* ------------------------------------------------------------------ */

function canopySetup() {
  var ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, CANOPY.SHEETS.SETTINGS, [
    ['Key', 'Value', 'Notes'],
    ['MANGOOLS_API_KEY', getProp_('MANGOOLS_API_KEY', ''), 'Also stored in Script Properties. Never share this file.'],
    ['DEFAULT_LOCATION_ID', getProp_('DEFAULT_LOCATION_ID', '2840'), '2840 = United States. Search via Canopy → Search locations.'],
    ['DEFAULT_LANGUAGE_ID', getProp_('DEFAULT_LANGUAGE_ID', '1000'), '1000 = English'],
    ['HOME_DOMAIN', getProp_('HOME_DOMAIN', ''), 'Your site for gap analysis and tracking'],
    ['COMPETITORS', getProp_('COMPETITORS', ''), 'Comma-separated, max 5'],
    ['TRACKING_ID', getProp_('TRACKING_ID', ''), 'SERPWatcher project id'],
    ['PLATFORM_ID', getProp_('PLATFORM_ID', '1'), '1 desktop, 2 mobile'],
    ['LLM_BASE_URL', getProp_('LLM_BASE_URL', 'https://api.x.ai/v1'), 'OpenAI-compatible chat endpoint'],
    ['LLM_API_KEY', getProp_('LLM_API_KEY', ''), 'Optional. Used by Brief / Scout agents.'],
    ['LLM_MODEL', getProp_('LLM_MODEL', 'grok-4.5'), 'Model id'],
    ['WEBHOOK_SECRET', getProp_('WEBHOOK_SECRET', randomSecret_()), 'Required for doPost agent automation'],
    ['DAILY_HOUR', getProp_('DAILY_HOUR', '6'), 'Hour (spreadsheet timezone) for Watch trigger']
  ]);
  ensureSheet_(ss, CANOPY.SHEETS.KEYWORDS, [[
    'Seed', 'Keyword', 'Location ID', 'Language ID', 'Volume', 'KD', 'CPC', 'PPC',
    'Opportunity', 'Status', 'Last fetched', 'Keyword ID', 'Notes', 'Agent'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.RELATED, [[
    'Seed', 'Keyword', 'Location ID', 'Volume', 'KD', 'CPC', 'PPC', 'Opportunity',
    'Keyword ID', 'Fetched'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.TRACKING, [[
    'Tracking ID', 'Domain', 'Keyword', 'Location ID', 'Device', 'Rank', 'Prev',
    'Change', 'Best', 'Visits', 'Volume', 'URL', 'Last check'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.COMPETITORS, [[
    'Domain', 'Keyword', 'Volume', 'KD', 'CPC', 'PPC', 'Position', 'Keyword ID'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.GAPS, [[
    'Keyword', 'Volume', 'CPC', 'Your position', 'Competitor', 'Competitor position'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.SERP, [[
    'Keyword', 'Position', 'URL', 'Title', 'Domain', 'KD', 'SERP features', 'Fetched'
  ]]);
  ensureSheet_(ss, CANOPY.SHEETS.LISTS, [['List ID', 'Name', 'Keywords', 'Updated']]);
  ensureSheet_(ss, CANOPY.SHEETS.AGENTS, [
    ['Agent', 'Action', 'Input', 'Status', 'Output', 'Last run', 'Auto'],
    ['Scout', 'seeds', 'waterproof field notebook for hikers', 'idle', '', '', 'FALSE'],
    ['Expander', 'related', 'Keywords!B2:B', 'idle', '', '', 'TRUE'],
    ['Assessor', 'bulk', 'Keywords!B2:B', 'idle', '', '', 'TRUE'],
    ['Rival', 'gap', '', 'idle', '', '', 'FALSE'],
    ['Watch', 'track', '', 'idle', '', '', 'TRUE'],
    ['Brief', 'brief', 'Keywords!B2', 'idle', '', '', 'FALSE']
  ]);
  ensureSheet_(ss, CANOPY.SHEETS.LOCATIONS, [['ID', 'Label', 'Country', 'Type', 'Google domain']]);
  ensureSheet_(ss, CANOPY.SHEETS.QUOTA, [['Resource', 'Limit', 'Remaining', 'Reset (s)', 'Checked']]);
  ensureSheet_(ss, CANOPY.SHEETS.LOG, [['When', 'Level', 'Action', 'Detail', 'HTTP', 'Credits']]);

  syncSettingsToProps_();
  styleWorkbook_(ss);
  canopyRefreshQuota();
  ss.toast('Canopy workbook is ready. Add your API key if you have not.', 'Canopy', 6);
}

function canopyPromptApiKey() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Mangools API key',
    'Paste the token from mangools.com/api-token. It is stored in Script Properties, not in cells, after save.',
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var key = res.getResponseText().trim();
  if (!key) return;
  setProp_('MANGOOLS_API_KEY', key);
  writeSetting_('MANGOOLS_API_KEY', '(stored in Script Properties)');
  canopyRefreshQuota();
  SpreadsheetApp.getActive().toast('API key saved.', 'Canopy', 4);
}

/* ------------------------------------------------------------------ */
/*  HTTP client                                                       */
/* ------------------------------------------------------------------ */

function mangoolsFetch_(path, opt) {
  opt = opt || {};
  var key = getApiKey_();
  var url = CANOPY.BASE + path;
  if (opt.query) url += (url.indexOf('?') === -1 ? '?' : '&') + toQuery_(opt.query);
  var method = (opt.method || 'get').toUpperCase();
  var payload = opt.body ? JSON.stringify(opt.body) : null;
  var attempt = 0;
  var wait = 600;

  while (true) {
    attempt++;
    var params = {
      method: method,
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'X-Access-Token': key,
        'Accept': 'application/json'
      }
    };
    if (payload) {
      params.contentType = 'application/json';
      params.payload = payload;
    }
    var res = UrlFetchApp.fetch(url, params);
    var code = res.getResponseCode();
    var text = res.getContentText();
    if (code === 429 && attempt <= CANOPY.MAX_RETRIES) {
      log_('warn', path, '429 Too Many Requests — backing off ' + wait + 'ms', code, 0);
      Utilities.sleep(wait);
      wait = Math.min(wait * 2, 8000);
      continue;
    }
    if (code >= 500 && attempt <= CANOPY.MAX_RETRIES) {
      Utilities.sleep(wait);
      wait = Math.min(wait * 2, 8000);
      continue;
    }
    var json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (err) { json = { raw: text }; }
    if (code >= 400) {
      var msg = (json && (json.message || json.error || json.detail)) || text.slice(0, 400);
      log_('error', path, msg, code, 0);
      throw new Error('Mangools ' + code + ' on ' + method + ' ' + path + ': ' + msg);
    }
    log_('info', path, method + ' ok', code, opt.credits || 0);
    return json;
  }
}

function toQuery_(obj) {
  var parts = [];
  Object.keys(obj).forEach(function (k) {
    if (obj[k] === undefined || obj[k] === null || obj[k] === '') return;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
  });
  return parts.join('&');
}

function getApiKey_() {
  syncSettingsToProps_();
  var key = getProp_('MANGOOLS_API_KEY', '');
  if (!key || key.indexOf('stored') !== -1) {
    throw new Error('Set MANGOOLS_API_KEY via Canopy → Save API key.');
  }
  return key;
}

/* ------------------------------------------------------------------ */
/*  Keyword research                                                  */
/* ------------------------------------------------------------------ */

function canopyBulkImport() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(CANOPY.SHEETS.KEYWORDS);
  var rows = readObjects_(sheet);
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var selected = getSelectedKeywords_(sheet, rows, 1);
  if (!selected.length) throw new Error('Select keyword cells in column B, or fill the Keywords sheet.');
  var chunks = chunk_(unique_(selected), CANOPY.MAX_BULK);
  var started = Date.now();
  var written = 0;
  chunks.forEach(function (keywords, i) {
    if (Date.now() - started > CANOPY.EXEC_BUDGET_MS) {
      log_('warn', 'keyword-imports', 'Stopped to stay under the 6-minute Apps Script cap. Re-run to continue.', 0, 0);
      return;
    }
    var data = mangoolsFetch_('/kwfinder/keyword-imports', {
      method: 'post',
      body: { keywords: keywords, location_id: loc, language_id: lang },
      credits: 1
    });
    written += upsertKeywordMetrics_(sheet, rows, data.keywords || [], loc, lang, 'Assessor');
    if (i < chunks.length - 1) Utilities.sleep(CANOPY.SHORT_PAUSE_MS);
  });
  ss.toast('Scored ' + written + ' keywords.', 'Canopy', 5);
}

function canopyRelated() {
  var ss = SpreadsheetApp.getActive();
  var seed = getActiveKeyword_() || getSetting_('LAST_SEED', '');
  if (!seed) {
    var ui = SpreadsheetApp.getUi();
    var res = ui.prompt('Related keywords', 'Seed keyword:', ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) return;
    seed = res.getResponseText().trim();
  }
  if (!seed) return;
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var data = mangoolsFetch_('/kwfinder/related-keywords', {
    query: { kw: seed, location_id: loc, language_id: lang },
    credits: 1
  });
  var out = ss.getSheetByName(CANOPY.SHEETS.RELATED);
  var values = (data.keywords || []).map(function (k) {
    return [
      seed,
      k.kw,
      k.lid || loc,
      num_(k.sv),
      k.seo == null ? '' : num_(k.seo),
      num_(k.cpc),
      num_(k.ppc),
      opportunity_(num_(k.sv), k.seo, num_(k.ppc)),
      k._id || '',
      new Date()
    ];
  });
  writeBelowHeader_(out, values, true);
  setProp_('LAST_SEED', seed);
  ss.toast((values.length) + ' related keywords for "' + seed + '".', 'Canopy', 5);
}

function canopySerp() {
  var kw = getActiveKeyword_();
  if (!kw) throw new Error('Select a keyword cell first.');
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var data = mangoolsFetch_('/serpchecker/serps', {
    query: { kw: kw, location_id: loc, language_id: lang },
    credits: 1
  });
  var items = data.organic || data.results || data.serps || data.items || [];
  var kd = data.seo || data.kd || (data.keyword && data.keyword.seo) || '';
  var features = serializeFeatures_(data);
  var rows = items.map(function (item, i) {
    return [
      kw,
      item.position || item.pos || (i + 1),
      item.url || item.link || '',
      item.title || '',
      item.domain || host_(item.url || item.link || ''),
      kd,
      features,
      new Date()
    ];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SERP), rows, true);
  patchKeywordKd_(kw, kd);
  SpreadsheetApp.getActive().toast('SERP stored (' + rows.length + ' URLs). KD=' + kd, 'Canopy', 5);
}

function canopySuggested() {
  var domain = getSetting_('HOME_DOMAIN', '');
  if (!domain) throw new Error('Set HOME_DOMAIN on the Settings sheet.');
  var data = mangoolsFetch_('/kwfinder/suggested-keywords', {
    query: { url: domain },
    credits: 1
  });
  var kws = (data.keywords || data.items || []).map(function (k) { return k.kw || k.keyword || k; });
  appendSeeds_(kws, 'suggested');
  SpreadsheetApp.getActive().toast('Suggested ' + kws.length + ' keywords for ' + domain, 'Canopy', 5);
}

/* ------------------------------------------------------------------ */
/*  Competitors & gaps                                                */
/* ------------------------------------------------------------------ */

function canopyCompetitorKeywords() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Competitor keywords', 'Domain, subdomain, or URL:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var url = res.getResponseText().trim();
  if (!url) return;
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var data = mangoolsFetch_('/kwfinder/competitor-keywords', {
    query: { url: url, location_id: loc },
    credits: 1
  });
  var rows = (data.keywords || []).map(function (k) {
    return [
      url,
      k.kw,
      num_(k.sv),
      k.seo == null ? '' : num_(k.seo),
      num_(k.cpc),
      num_(k.ppc),
      (k.h && k.h[0] && k.h[0][2]) || '',
      k._id || ''
    ];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.COMPETITORS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' competitor keywords for ' + url, 'Canopy', 5);
}

function canopyGapAnalysis() {
  var domain = getSetting_('HOME_DOMAIN', '');
  var comps = getSetting_('COMPETITORS', '')
    .split(',')
    .map(function (s) { return s.trim(); })
    .filter(Boolean)
    .slice(0, 5);
  if (!domain) throw new Error('Set HOME_DOMAIN on Settings.');
  if (!comps.length) throw new Error('Set COMPETITORS on Settings (comma-separated, max 5).');
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var data = mangoolsFetch_('/kwfinder/gap-analysis', {
    method: 'post',
    body: { domain: domain, competitors: comps, location_id: loc },
    credits: 1
  });
  var rows = [];
  (data.results || []).forEach(function (block) {
    (block.items || []).forEach(function (item) {
      rows.push([
        item.keyword || item.kw,
        num_(item.search_volume || item.sv),
        num_(item.cpc),
        item.your_position == null ? '' : item.your_position,
        block.domain || item.competitor || '',
        item.competitor_position || ''
      ]);
    });
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.GAPS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' gap keywords.', 'Canopy', 5);
}

/* ------------------------------------------------------------------ */
/*  Rank tracking                                                     */
/* ------------------------------------------------------------------ */

function canopyRefreshTracking() {
  var id = getSetting_('TRACKING_ID', '');
  if (!id) {
    var trackings = mangoolsFetch_('/serpwatcher/trackings');
    var list = trackings.trackings || trackings.items || trackings || [];
    if (!Array.isArray(list) || !list.length) throw new Error('No SERPWatcher trackings. Create one first.');
    id = list[0]._id || list[0].id;
    writeSetting_('TRACKING_ID', id);
  }
  var detail = mangoolsFetch_('/serpwatcher/trackings/' + encodeURIComponent(id) + '/detail');
  var stats = mangoolsFetch_('/serpwatcher/trackings/' + encodeURIComponent(id) + '/stats', { method: 'post', body: {} });
  var domain = (detail.domain || getSetting_('HOME_DOMAIN', ''));
  var loc = detail.location_id || getSetting_('DEFAULT_LOCATION_ID', '');
  var device = Number(detail.platform_id || getSetting_('PLATFORM_ID', 1)) === 2 ? 'mobile' : 'desktop';
  var byKw = indexBy_(stats.keywords || stats.items || [], function (k) { return (k.kw || k.keyword || '').toLowerCase(); });
  var rows = (detail.keywords || detail.tracked_keywords || stats.keywords || []).map(function (k) {
    var kw = k.kw || k.keyword;
    var s = byKw[(kw || '').toLowerCase()] || k;
    var rank = firstNum_(s.rank, s.position, s.current_rank);
    var prev = firstNum_(s.prev, s.previous_rank, s.rank_previous);
    var change = (rank != null && prev != null) ? (prev - rank) : '';
    return [
      id,
      domain,
      kw,
      loc,
      device,
      rank == null ? '' : rank,
      prev == null ? '' : prev,
      change,
      firstNum_(s.best, s.best_rank, '') || '',
      num_(s.visits || s.estimated_visits),
      num_(s.sv || s.search_volume),
      s.url || s.ranking_url || '',
      new Date()
    ];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.TRACKING), rows, true);
  SpreadsheetApp.getActive().toast('Tracking refreshed (' + rows.length + ' keywords).', 'Canopy', 5);
}

function canopyCreateTracking() {
  var domain = getSetting_('HOME_DOMAIN', '');
  if (!domain) throw new Error('Set HOME_DOMAIN on Settings.');
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);
  var kws = unique_(readObjects_(sheet).map(function (r) { return r.Keyword; }).filter(Boolean)).slice(0, 50);
  if (!kws.length) throw new Error('Add keywords before creating a tracking.');
  var body = {
    domain: domain,
    location_id: Number(getSetting_('DEFAULT_LOCATION_ID', 2840)),
    platform_id: Number(getSetting_('PLATFORM_ID', 1)),
    keywords: kws
  };
  var data = mangoolsFetch_('/serpwatcher/trackings', { method: 'post', body: body, credits: kws.length });
  var id = data._id || data.id || (data.tracking && (data.tracking._id || data.tracking.id));
  if (id) writeSetting_('TRACKING_ID', id);
  SpreadsheetApp.getActive().toast('Tracking created' + (id ? ': ' + id : ''), 'Canopy', 6);
}

/* ------------------------------------------------------------------ */
/*  Lists, locations, quota                                           */
/* ------------------------------------------------------------------ */

function canopySyncLists() {
  var data = mangoolsFetch_('/kwfinder/lists');
  var lists = data.lists || data.items || data || [];
  var rows = (Array.isArray(lists) ? lists : []).map(function (l) {
    return [l._id || l.id, l.name || l.title, l.count || (l.keywords && l.keywords.length) || '', new Date()];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LISTS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' lists synced.', 'Canopy', 4);
}

function canopySearchLocations() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Locations', 'City, region, or country:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var q = res.getResponseText().trim();
  if (!q) return;
  var data = mangoolsFetch_('/mangools/locations', { query: { query: q } });
  var items = data.locations || data.items || data || [];
  var rows = (Array.isArray(items) ? items : []).map(function (l) {
    return [l._id || l.id, l.label || l.name || l.canonical_name, l.country_code || l.code, l.type || '', l.google_domain || ''];
  });
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LOCATIONS), rows, true);
  SpreadsheetApp.getActive().toast(rows.length + ' locations. Copy an ID into DEFAULT_LOCATION_ID.', 'Canopy', 6);
}

function canopyRefreshQuota() {
  var data = mangoolsFetch_('/kwfinder/limits');
  var now = new Date();
  var rows = [];
  Object.keys(data).forEach(function (k) {
    var v = data[k];
    if (v && typeof v === 'object' && 'limit' in v) {
      rows.push([k, v.limit, v.remaining, v.reset, now]);
    }
  });
  if (data.resources && data.resources.limit != null) {
    rows.unshift(['keyword lookups (resources)', data.resources.limit, data.resources.remaining, data.resources.reset, now]);
  }
  writeBelowHeader_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.QUOTA), rows, true);
}

/* ------------------------------------------------------------------ */
/*  Custom functions (use in cells)                                   */
/* ------------------------------------------------------------------ */

/**
 * Average monthly search volume for a keyword.
 * @param {string} keyword
 * @param {number} location_id Optional. Default from Settings.
 * @param {number} language_id Optional.
 * @return {number}
 * @customfunction
 */
function MANGOOLS_VOLUME(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return num_(k.sv);
}

/**
 * Keyword difficulty (cached). Empty if Mangools has not computed KD yet —
 * run Canopy → Fetch SERP + live KD to recompute.
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_KD(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return k.seo == null ? '' : num_(k.seo);
}

/**
 * Cost per click.
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_CPC(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return num_(k.cpc);
}

/**
 * PPC competition 0–100.
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_PPC(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return num_(k.ppc);
}

/**
 * Opportunity score: volume / (KD+8) × (1 − 0.45·PPC).
 * @param {string} keyword
 * @customfunction
 */
function MANGOOLS_SCORE(keyword, location_id, language_id) {
  var k = fetchOne_(keyword, location_id, language_id);
  return opportunity_(num_(k.sv), k.seo, num_(k.ppc));
}

function fetchOne_(keyword, location_id, language_id) {
  if (!keyword) return {};
  var loc = Number(location_id || getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(language_id || getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  var cache = CacheService.getDocumentCache();
  var ck = 'kw_' + loc + '_' + lang + '_' + String(keyword).toLowerCase();
  var hit = cache.get(ck);
  if (hit) return JSON.parse(hit);
  var data = mangoolsFetch_('/kwfinder/keyword-imports', {
    method: 'post',
    body: { keywords: [String(keyword)], location_id: loc, language_id: lang },
    credits: 1
  });
  var k = (data.keywords && data.keywords[0]) || {};
  cache.put(ck, JSON.stringify(k), 21600);
  return k;
}

/* ------------------------------------------------------------------ */
/*  Triggers                                                          */
/* ------------------------------------------------------------------ */

function canopyInstallTriggers() {
  canopyRemoveTriggers();
  var hour = Number(getSetting_('DAILY_HOUR', 6));
  ScriptApp.newTrigger('canopyDailyJob').timeBased().atHour(hour).everyDays(1).create();
  SpreadsheetApp.getActive().toast('Daily trigger installed at hour ' + hour + '.', 'Canopy', 5);
}

function canopyRemoveTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    if (h === 'canopyDailyJob' || h === 'canopyRunAgents') ScriptApp.deleteTrigger(t);
  });
}

function canopyDailyJob() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    canopyRefreshQuota();
    try { canopyRefreshTracking(); } catch (e) { log_('warn', 'daily.track', e.message, 0, 0); }
    canopyRunAgents(true);
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Agents                                                            */
/* ------------------------------------------------------------------ */

function canopyRunAgents(autoOnly) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.AGENTS);
  if (!sheet) return;
  var rows = readObjects_(sheet);
  rows.forEach(function (row, i) {
    if (autoOnly && String(row.Auto).toUpperCase() !== 'TRUE') return;
    var status = String(row.Status || 'idle').toLowerCase();
    if (status === 'skip' || status === 'done') return;
    var agent = String(row.Agent || '').toLowerCase();
    var action = String(row.Action || agent).toLowerCase();
    var input = String(row.Input || '');
    try {
      var output = runAgentTask_(agent, action, input);
      sheet.getRange(i + 2, 4, 1, 3).setValues([['ok', String(output).slice(0, 400), new Date()]]);
    } catch (err) {
      sheet.getRange(i + 2, 4, 1, 3).setValues([['error', err.message.slice(0, 400), new Date()]]);
    }
  });
}

function runAgentTask_(agent, action, input) {
  if (action === 'related' || agent === 'expander') {
    if (input.indexOf('!') !== -1) {
      var seeds = flattenRange_(input);
      seeds.slice(0, 5).forEach(function (s, idx) {
        SpreadsheetApp.getActive().setActiveRange(
          SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS).getRange('B2')
        );
        setProp_('LAST_SEED', s);
        if (idx) Utilities.sleep(CANOPY.SHORT_PAUSE_MS);
        var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
        var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
        mangoolsFetch_('/kwfinder/related-keywords', {
          query: { kw: s, location_id: loc, language_id: lang },
          credits: 1
        });
      });
      return 'Expanded ' + Math.min(5, seeds.length) + ' seeds';
    }
    setProp_('LAST_SEED', input);
    canopyRelated();
    return 'related ' + input;
  }
  if (action === 'bulk' || agent === 'assessor') {
    canopyBulkImport();
    return 'bulk scored';
  }
  if (action === 'gap' || agent === 'rival') {
    canopyGapAnalysis();
    return 'gap analysis';
  }
  if (action === 'track' || agent === 'watch') {
    canopyRefreshTracking();
    return 'tracking refreshed';
  }
  if (action === 'seeds' || agent === 'scout' || action === 'brief' || agent === 'brief') {
    return llmAgent_(agent || action, input);
  }
  throw new Error('Unknown agent action: ' + action);
}

function llmAgent_(role, input) {
  var key = getSetting_('LLM_API_KEY', '');
  if (!key) {
    if (role === 'scout' || role === 'seeds') {
      var guesses = String(input).split(/[,\\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      appendSeeds_(guesses, 'Scout');
      return 'Queued ' + guesses.length + ' seeds (no LLM key; used input as list)';
    }
    return 'No LLM_API_KEY set — skipped ' + role;
  }
  var base = getSetting_('LLM_BASE_URL', 'https://api.x.ai/v1').replace(/\\/$/, '');
  var model = getSetting_('LLM_MODEL', 'grok-4.5');
  var system = role === 'brief' || role === 'Brief'
    ? 'You write concise SEO content briefs. Return markdown: search intent, outline (H2s), questions to answer, internal links, and a title. 250 words max.'
    : 'You are an SEO keyword researcher. Return 15 seed keywords as a JSON array of strings. No commentary.';
  var res = UrlFetchApp.fetch(base + '/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + key },
    payload: JSON.stringify({
      model: model,
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: String(input) }
      ]
    })
  });
  if (res.getResponseCode() >= 400) throw new Error('LLM ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 240));
  var body = JSON.parse(res.getContentText());
  var text = (((body.choices || [])[0] || {}).message || {}).content || '';
  if (role === 'scout' || role === 'seeds') {
    var seeds = parseJsonArray_(text);
    appendSeeds_(seeds, 'Scout');
    return 'Scout added ' + seeds.length + ' seeds';
  }
  return text.slice(0, 500);
}

/* ------------------------------------------------------------------ */
/*  Web app API — for Cursor, Claude, custom agents                   */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return jsonOut_({ ok: true, service: 'canopy', hint: 'POST JSON { secret, action, payload }' });
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {
    return jsonOut_({ ok: false, error: 'invalid json' }, 400);
  }
  var secret = getSetting_('WEBHOOK_SECRET', '');
  if (!secret || body.secret !== secret) return jsonOut_({ ok: false, error: 'unauthorized' }, 401);
  var action = String(body.action || '');
  var payload = body.payload || {};
  try {
    var result = dispatchAction_(action, payload);
    return jsonOut_({ ok: true, action: action, result: result });
  } catch (err) {
    return jsonOut_({ ok: false, action: action, error: err.message });
  }
}

function dispatchAction_(action, payload) {
  switch (action) {
    case 'quota':
      canopyRefreshQuota();
      return readObjects_(SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.QUOTA)).slice(0, 20);
    case 'read':
      return readObjects_(SpreadsheetApp.getActive().getSheetByName(payload.sheet || CANOPY.SHEETS.KEYWORDS)).slice(0, payload.limit || 200);
    case 'write':
      appendSeeds_(payload.keywords || [], payload.agent || 'api');
      return { added: (payload.keywords || []).length };
    case 'related':
      setProp_('LAST_SEED', payload.keyword || payload.kw);
      canopyRelated();
      return { seed: payload.keyword || payload.kw };
    case 'bulk':
      if (payload.keywords) appendSeeds_(payload.keywords, 'api');
      canopyBulkImport();
      return { ok: true };
    case 'competitor':
      if (payload.url) {
        var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
        return mangoolsFetch_('/kwfinder/competitor-keywords', { query: { url: payload.url, location_id: loc }, credits: 1 });
      }
      throw new Error('payload.url required');
    case 'gap':
      canopyGapAnalysis();
      return { ok: true };
    case 'track':
      canopyRefreshTracking();
      return { ok: true };
    case 'agent':
      return runAgentTask_(payload.agent || '', payload.action || payload.agent || '', payload.input || '');
    case 'setting':
      if (!payload.key) throw new Error('payload.key required');
      writeSetting_(payload.key, String(payload.value || ''));
      return { key: payload.key };
    default:
      throw new Error('Unknown action. Use quota|read|write|related|bulk|competitor|gap|track|agent|setting');
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/*  Sheet helpers                                                     */
/* ------------------------------------------------------------------ */

function ensureSheet_(ss, name, headerAndSeed) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0 && headerAndSeed && headerAndSeed.length) {
    sh.getRange(1, 1, headerAndSeed.length, headerAndSeed[0].length).setValues(headerAndSeed);
  } else if (headerAndSeed && headerAndSeed[0] && sh.getRange(1, 1).getValue() === '') {
    sh.getRange(1, 1, 1, headerAndSeed[0].length).setValues([headerAndSeed[0]]);
  }
  return sh;
}

function styleWorkbook_(ss) {
  var names = Object.keys(CANOPY.SHEETS).map(function (k) { return CANOPY.SHEETS[k]; });
  names.forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) return;
    var lastCol = Math.max(sh.getLastColumn(), 1);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, lastCol)
      .setFontFamily('Google Sans')
      .setFontWeight('bold')
      .setBackground('#1c1914')
      .setFontColor('#f3f0e7');
    sh.setRowHeight(1, 28);
  });
}

function writeBelowHeader_(sheet, values, clear) {
  if (clear && sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  }
  if (!values.length) return;
  sheet.getRange(2, 1, values.length, values[0].length).setValues(values);
}

function readObjects_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var obj = { _row: i + 1 };
    var empty = true;
    headers.forEach(function (h, c) {
      obj[h] = data[i][c];
      if (data[i][c] !== '' && data[i][c] != null) empty = false;
    });
    if (!empty) out.push(obj);
  }
  return out;
}

function getSelectedKeywords_(sheet, rows, colIndex) {
  var range = SpreadsheetApp.getActiveRange();
  var picked = [];
  if (range && range.getSheet().getName() === sheet.getName()) {
    range.getValues().forEach(function (r) {
      r.forEach(function (v) { if (v) picked.push(String(v).trim()); });
    });
  }
  if (picked.length) return picked.filter(function (v) { return v && v !== 'Keyword' && v !== 'Seed'; });
  return rows.map(function (r) { return String(r.Keyword || r.Seed || '').trim(); }).filter(Boolean);
}

function getActiveKeyword_() {
  var v = SpreadsheetApp.getActiveRange() && SpreadsheetApp.getActiveRange().getValue();
  if (v && typeof v !== 'object') return String(v).trim();
  return '';
}

function upsertKeywordMetrics_(sheet, existing, keywords, loc, lang, agent) {
  var byKw = {};
  existing.forEach(function (r) { byKw[String(r.Keyword).toLowerCase()] = r; });
  var writes = 0;
  keywords.forEach(function (k) {
    var key = String(k.kw || '').toLowerCase();
    if (!key) return;
    var opp = opportunity_(num_(k.sv), k.seo, num_(k.ppc));
    var line = [
      (byKw[key] && byKw[key].Seed) || k.kw,
      k.kw,
      k.lid || loc,
      lang,
      num_(k.sv),
      k.seo == null ? '' : num_(k.seo),
      num_(k.cpc),
      num_(k.ppc),
      opp,
      (byKw[key] && byKw[key].Status) || 'new',
      new Date(),
      k._id || '',
      (byKw[key] && byKw[key].Notes) || '',
      agent
    ];
    if (byKw[key]) {
      sheet.getRange(byKw[key]._row, 1, 1, line.length).setValues([line]);
    } else {
      sheet.appendRow(line);
    }
    writes++;
  });
  return writes;
}

function appendSeeds_(keywords, agent) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);
  var have = {};
  readObjects_(sheet).forEach(function (r) { have[String(r.Keyword).toLowerCase()] = true; });
  var loc = Number(getSetting_('DEFAULT_LOCATION_ID', 2840));
  var lang = Number(getSetting_('DEFAULT_LANGUAGE_ID', 1000));
  keywords.forEach(function (kw) {
    kw = String(kw || '').trim();
    if (!kw || have[kw.toLowerCase()]) return;
    sheet.appendRow([kw, kw, loc, lang, '', '', '', '', '', 'new', '', '', 'Added by ' + agent, agent]);
    have[kw.toLowerCase()] = true;
  });
}

function patchKeywordKd_(kw, kd) {
  if (kd === '' || kd == null) return;
  var sheet = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.KEYWORDS);
  readObjects_(sheet).forEach(function (r) {
    if (String(r.Keyword).toLowerCase() === String(kw).toLowerCase()) {
      sheet.getRange(r._row, 6).setValue(kd);
    }
  });
}

function getSetting_(key, fallback) {
  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);
  if (sh) {
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        var val = String(data[i][1] == null ? '' : data[i][1]).trim();
        if (val && val.indexOf('stored in Script') === -1) return val;
      }
    }
  }
  return getProp_(key, fallback);
}

function writeSetting_(key, value) {
  setProp_(key, value);
  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sh.getRange(i + 1, 2).setValue(key === 'MANGOOLS_API_KEY' ? '(stored in Script Properties)' : value);
      return;
    }
  }
  sh.appendRow([key, value, '']);
}

function syncSettingsToProps_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.SETTINGS);
  if (!sh) return;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    var v = String(data[i][1] == null ? '' : data[i][1]).trim();
    if (!k || !v) continue;
    if (k === 'MANGOOLS_API_KEY' && v.indexOf('stored') !== -1) continue;
    setProp_(k, v);
  }
}

function getProp_(k, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(k);
  return v == null || v === '' ? fallback : v;
}

function setProp_(k, v) {
  PropertiesService.getScriptProperties().setProperty(k, String(v));
}

function log_(level, action, detail, http, credits) {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(CANOPY.SHEETS.LOG);
    if (!sh) return;
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, 6).setValues([[new Date(), level, action, String(detail).slice(0, 500), http || '', credits || 0]]);
  } catch (err) {}
}

function opportunity_(volume, kd, ppc) {
  var d = kd == null || kd === '' ? 45 : Number(kd);
  var c = Math.min(100, Math.max(0, Number(ppc) || 0)) / 100;
  var raw = (Number(volume) || 0) / (d + 8) * (1 - c * 0.45);
  return Math.round(raw * 10) / 10;
}

function num_(v) {
  if (v == null || v === '') return 0;
  var n = Number(v);
  return isNaN(n) ? 0 : n;
}

function firstNum_() {
  for (var i = 0; i < arguments.length; i++) {
    if (arguments[i] === '' || arguments[i] == null) continue;
    var n = Number(arguments[i]);
    if (!isNaN(n)) return n;
  }
  return null;
}

function unique_(arr) {
  var seen = {};
  var out = [];
  arr.forEach(function (v) {
    var k = String(v).toLowerCase();
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(String(v));
  });
  return out;
}

function chunk_(arr, size) {
  var out = [];
  for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function indexBy_(arr, fn) {
  var o = {};
  (arr || []).forEach(function (x) { o[fn(x)] = x; });
  return o;
}

function host_(url) {
  try { return String(url).replace(/^https?:\\/\\//, '').split('/')[0]; } catch (e) { return ''; }
}

function serializeFeatures_(data) {
  var f = data.features || data.serp_features || [];
  if (Array.isArray(f)) return f.join(', ');
  if (f && typeof f === 'object') return Object.keys(f).filter(function (k) { return f[k]; }).join(', ');
  return '';
}

function flattenRange_(a1) {
  try {
    return SpreadsheetApp.getActive().getRange(a1).getValues()
      .reduce(function (acc, r) { return acc.concat(r); }, [])
      .map(function (v) { return String(v || '').trim(); })
      .filter(Boolean);
  } catch (e) {
    return [a1];
  }
}

function parseJsonArray_(text) {
  var m = String(text).match(/\\[[\\s\\S]*\\]/);
  if (m) {
    try {
      var arr = JSON.parse(m[0]);
      if (Array.isArray(arr)) return arr.map(function (x) { return String(x); });
    } catch (e) {}
  }
  return String(text).split(/\\n/).map(function (s) { return s.replace(/^[\\-\\*\\d\\.\\s]+/, '').trim(); }).filter(Boolean).slice(0, 20);
}

function randomSecret_() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var s = 'cnp_';
  for (var i = 0; i < 24; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}
`,un=`{
  "timeZone": "America/New_York",
  "runtimeVersion": "V8",
  "exceptionLogging": "STACKDRIVER",
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.container.ui"
  ],
  "webapp": {
    "access": "ANYONE_ANONYMOUS",
    "executeAs": "USER_DEPLOYING"
  }
}
`,dn=ln,fn=un,pn=[{name:`canopySetup`,does:`Create all sheets, headers, formatting, quota check`},{name:`canopyPromptApiKey`,does:`Store X-Access-Token in Script Properties`},{name:`canopyBulkImport`,does:`POST /kwfinder/keyword-imports up to 700 kws`},{name:`canopyRelated`,does:`GET /kwfinder/related-keywords for the active cell`},{name:`canopySerp`,does:`GET /serpchecker/serps and live KD`},{name:`canopyCompetitorKeywords`,does:`GET /kwfinder/competitor-keywords`},{name:`canopyGapAnalysis`,does:`POST /kwfinder/gap-analysis vs Settings competitors`},{name:`canopyRefreshTracking`,does:`SERPWatcher detail + stats → Tracking tab`},{name:`canopyCreateTracking`,does:`POST /serpwatcher/trackings from Keywords`},{name:`canopySyncLists`,does:`GET /kwfinder/lists`},{name:`canopySearchLocations`,does:`GET /mangools/locations`},{name:`canopyRunAgents`,does:`Execute due rows on the Agents sheet`},{name:`canopyDailyJob`,does:`Quota + ranks + auto agents (time trigger)`},{name:`doPost`,does:`JSON webhook for Cursor / Claude / custom agents`}],mn=[{sig:`=MANGOOLS_VOLUME("waterproof notebook")`,out:`Average monthly search volume`},{sig:`=MANGOOLS_KD(A2)`,out:`Cached keyword difficulty (empty until SERP/KD)`},{sig:`=MANGOOLS_CPC(A2, 2840, 1000)`,out:`CPC for US English`},{sig:`=MANGOOLS_PPC(A2)`,out:`Paid competition 0–100`},{sig:`=MANGOOLS_SCORE(A2)`,out:`Volume / (KD+8) × (1 − 0.45·PPC)`}];function hn(){let[e,t]=(0,X.useState)(null);function n(e,n){navigator.clipboard.writeText(n),t(e),c.success(`Copied`),setTimeout(()=>t(null),1500)}function r(e,t,n){let r=new Blob([t],{type:n}),i=URL.createObjectURL(r),a=document.createElement(`a`);a.href=i,a.download=e,a.click(),URL.revokeObjectURL(i)}let i=`curl -sS -X POST "$WEBAPP_URL" \\
  -H "Content-Type: application/json" \\
  -d '{
    "secret": "YOUR_WEBHOOK_SECRET",
    "action": "related",
    "payload": { "keyword": "waterproof field notebook" }
  }'`;return(0,K.jsxs)(`div`,{className:`grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]`,children:[(0,K.jsxs)(`section`,{children:[(0,K.jsx)(`p`,{className:`text-xs font-medium uppercase tracking-widest text-muted`,children:`Install`}),(0,K.jsx)(`h1`,{className:`font-display text-3xl font-medium tracking-tight sm:text-4xl`,children:`Apps Script`}),(0,K.jsx)(`p`,{className:`mt-1 max-w-2xl text-sm text-muted`,children:`One file. Paste into Extensions → Apps Script, save, reload the spreadsheet, then Canopy → Setup workbook. The script talks to api.mangools.com/v3 with X-Access-Token, retries 429s, and chunks work under the 6-minute cap.`}),(0,K.jsxs)(`div`,{className:`mt-4 flex flex-wrap gap-2`,children:[(0,K.jsxs)(q,{onClick:()=>n(`gs`,dn),children:[e===`gs`?(0,K.jsx)(h,{className:`size-4`}):(0,K.jsx)(_,{className:`size-4`}),`Copy Code.gs`]}),(0,K.jsxs)(q,{variant:`ghost`,onClick:()=>n(`json`,fn),children:[e===`json`?(0,K.jsx)(h,{className:`size-4`}):(0,K.jsx)(_,{className:`size-4`}),`Copy appsscript.json`]}),(0,K.jsxs)(q,{variant:`quiet`,onClick:()=>r(`Code.gs`,dn,`text/plain`),children:[(0,K.jsx)(v,{className:`size-4`}),`Download`]})]}),(0,K.jsx)(`pre`,{className:`mt-4 max-h-[min(62vh,720px)] overflow-auto rounded-2xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-paper shadow-[var(--shadow-border)]`,children:dn})]}),(0,K.jsxs)(`aside`,{className:`grid h-fit gap-4`,children:[(0,K.jsxs)(`div`,{className:`rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]`,children:[(0,K.jsx)(`h2`,{className:`font-display text-lg font-medium`,children:`Menu map`}),(0,K.jsx)(`ul`,{className:`mt-3 space-y-2 text-sm`,children:pn.map(e=>(0,K.jsxs)(`li`,{children:[(0,K.jsx)(`code`,{className:`font-mono text-xs text-accent`,children:e.name}),(0,K.jsx)(`p`,{className:`text-muted`,children:e.does})]},e.name))})]}),(0,K.jsxs)(`div`,{className:`rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]`,children:[(0,K.jsx)(`h2`,{className:`font-display text-lg font-medium`,children:`Sheet formulas`}),(0,K.jsx)(`ul`,{className:`mt-3 space-y-2 text-sm`,children:mn.map(e=>(0,K.jsxs)(`li`,{children:[(0,K.jsx)(`code`,{className:`font-mono text-xs text-fg`,children:e.sig}),(0,K.jsx)(`p`,{className:`text-muted`,children:e.out})]},e.sig))})]}),(0,K.jsxs)(`div`,{className:`rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]`,children:[(0,K.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,K.jsx)(`h2`,{className:`font-display text-lg font-medium`,children:`Agent webhook`}),(0,K.jsx)(J,{tone:`accent`,children:`doPost`})]}),(0,K.jsx)(`p`,{className:`mt-1 text-sm text-muted`,children:`Deploy → Web app → execute as you, anyone with the link. Actions: quota, read, write, related, bulk, competitor, gap, track, agent, setting.`}),(0,K.jsx)(`pre`,{className:`mt-3 overflow-auto rounded-lg bg-bg p-3 font-mono text-[11px] text-muted`,children:i}),(0,K.jsxs)(q,{size:`sm`,variant:`ghost`,className:`mt-2`,onClick:()=>n(`curl`,i),children:[e===`curl`?(0,K.jsx)(h,{className:`size-4`}):(0,K.jsx)(_,{className:`size-4`}),`Copy curl`]})]})]})]})}var gn=Rt({method:`POST`}).handler(n(`db4438b6ba10af6a780134d542f6ebbf5864d1ed44e8cdac6b1803e487453678`));function Q(e){let t=Number(e);return Number.isFinite(t)?t:0}function _n(e){if(!Array.isArray(e))return[];if(e.length&&typeof e[0]==`number`&&e.length<=24&&e.every(e=>typeof e==`number`)){if(e.length%3==0&&e[0]>2e3&&e[0]<2100){let t=[];for(let n=2;n<e.length;n+=3)t.push(Q(e[n]));return t}return e.map(Q)}return[]}function vn(e,t,n,r,i){let a=Sn(e),o=Cn();return a.map((e,a)=>{let s=String(e.kw??e.keyword??``),c=Q(e.sv??e.search_volume),l=e.seo==null?null:Q(e.seo),u=Q(e.cpc),d=Q(e.ppc);return{id:String(e._id??`${s}-${a}`),seed:t,keyword:s,location:Mt(Q(e.lid)||n),locationId:Q(e.lid)||n,language:Nt(r),languageId:r,volume:c,msv:_n(e.msv),kd:l,cpc:u,ppc:d,opportunity:ht(c,l,d),status:`new`,lastFetched:o,keywordId:String(e._id??``),notes:``,agent:i}})}function yn(e,t){return Sn(e).map((e,n)=>({id:String(e._id??n),domain:t,keyword:String(e.kw??e.keyword??``),volume:Q(e.sv),kd:e.seo==null?null:Q(e.seo),cpc:Q(e.cpc),position:Array.isArray(e.h)&&Array.isArray(e.h[0])?Q(e.h[0][2]):null,visitsEst:Q(e.svn)}))}function bn(e){let t=e,n=[];for(let e of t.results??[])for(let t of e.items??[])n.push({id:`${e.domain}-${t.keyword}`,keyword:String(t.keyword??t.kw??``),volume:Q(t.search_volume??t.sv),cpc:Q(t.cpc),yourPosition:t.your_position==null?null:Q(t.your_position),competitor:String(e.domain??t.competitor??``),competitorPosition:Q(t.competitor_position)});return n}function xn(e){let t=e,n=t.resources??{},r=t.serps??{},i=t.tracked_keywords??t[`tracked-keywords`]??{};return{lookups:{limit:Q(n.limit)||500,remaining:Q(n.remaining)||0},serps:{limit:Q(r.limit)||500,remaining:Q(r.remaining)||0},tracked:{limit:typeof i==`number`?i:Q(i.limit)||200,remaining:typeof i==`number`?i:Q(i.remaining)||0},resetHours:Math.max(1,Math.round(Q(n.reset)/3600)||12),live:!0}}function Sn(e){if(Array.isArray(e))return e;let t=e;return t.keywords??t.items??[]}function Cn(){let e=new Date,t=e=>String(e).padStart(2,`0`);return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}`}async function wn(e,t){let n=Z.getState().settings.apiKey;if(!n)throw Error(`Add your Mangools API key in Setup.`);let r=await gn({data:{apiKey:n,path:e,method:t.method??`GET`,query:t.query,body:t.body}});if(!(`ok`in r)||!r.ok)throw Error(`error`in r?String(r.error):`Mangools request failed`);return r.data}async function Tn(){let e=xn(await wn(`/kwfinder/limits`,{}));return Z.getState().setQuota(e),Z.getState().addLog({at:$(),level:`info`,action:`limits`,detail:`${e.lookups.remaining}/${e.lookups.limit} lookups remaining`,credits:0}),e}async function En(e){let{settings:t}=Z.getState(),n=vn(await wn(`/kwfinder/related-keywords`,{query:{kw:e,location_id:t.locationId,language_id:t.languageId}}),e,t.locationId,t.languageId,`Expander`);return Z.getState().setRelated(n),Z.getState().addLog({at:$(),level:`info`,action:`related-keywords`,detail:`seed=${e} · ${n.length} ideas`,credits:1}),n}async function Dn(e){let{settings:t}=Z.getState(),n=[...new Set(e.map(e=>e.trim()).filter(Boolean))].slice(0,700);if(!n.length)throw Error(`No keywords to score.`);let r=vn(await wn(`/kwfinder/keyword-imports`,{method:`POST`,body:{keywords:n,location_id:t.locationId,language_id:t.languageId}}),n[0]??``,t.locationId,t.languageId,`Assessor`);return Z.getState().mergeKeywords(r),Z.getState().addLog({at:$(),level:`info`,action:`keyword-imports`,detail:`${r.length} keywords scored`,credits:1}),r}async function On(e){let{settings:t}=Z.getState(),n=yn(await wn(`/kwfinder/competitor-keywords`,{query:{url:e,location_id:t.locationId}}),e);return Z.getState().setCompetitors(n),Z.getState().addLog({at:$(),level:`info`,action:`competitor-keywords`,detail:`${e} · ${n.length} keywords`,credits:1}),n}async function kn(e){let{settings:t}=Z.getState();if(!t.domain)throw Error(`Set a home domain in Setup.`);let n=e.map(e=>e.trim()).filter(Boolean).slice(0,5);if(!n.length)throw Error(`Need at least one competitor.`);let r=bn(await wn(`/kwfinder/gap-analysis`,{method:`POST`,body:{domain:t.domain,competitors:n,location_id:t.locationId}}));return Z.getState().setGaps(r),Z.getState().addLog({at:$(),level:`info`,action:`gap-analysis`,detail:`${t.domain} vs ${n.join(`, `)} · ${r.length} gaps`,credits:1}),r}function $(){let e=new Date,t=e=>String(e).padStart(2,`0`);return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}`}var An=[{n:`01`,title:`Get a Mangools token`,body:`Create a free Mangools account and copy the key from mangools.com/api-token. Every request uses the X-Access-Token header — never put it in a URL.`,href:`https://mangools.com/api-token`,hrefLabel:`Open API token page`},{n:`02`,title:`Paste it here to trial live calls`,body:`Stored only in this browser. Canopy proxies lookups from the Sheet tab so you can verify credits before wiring Google.`},{n:`03`,title:`New Google Sheet → Apps Script`,body:`Extensions → Apps Script. Delete the stub. Paste Code.gs. Add appsscript.json via Project settings → Show appsscript.json, then paste the manifest. Save.`},{n:`04`,title:`Reload and run Setup workbook`,body:`Back in Sheets, Canopy appears in the menu. Run Setup workbook, then Save API key. Authorize UrlFetch and Spreadsheets when asked.`},{n:`05`,title:`Install the daily trigger`,body:`Canopy → Install daily trigger. Watch refreshes ranks; Assessor/Expander rows with Auto=TRUE run inside the 6-minute budget.`},{n:`06`,title:`Point your other agents at doPost`,body:`Deploy → New deployment → Web app. Anyone with the link + WEBHOOK_SECRET can read the sheet, expand keywords, or run a named agent. Pair with Mangools MCP in Cursor if you want the same data in chat.`,href:`https://mangools.com/mcp`,hrefLabel:`Mangools MCP`}];function jn(){let e=Z(e=>e.settings),t=Z(e=>e.patchSettings),n=Z(e=>e.quota),r=Z(e=>e.resetDemo),[i,a]=(0,X.useState)(!1),[o,s]=(0,X.useState)(e.apiKey),[l,u]=(0,X.useState)({});async function d(){t({apiKey:o.trim()}),a(!0);try{let e=await Tn();c.success(`Connected · ${e.lookups.remaining} lookups left`)}catch(e){c.error(e instanceof Error?e.message:`Could not reach Mangools`)}finally{a(!1)}}return(0,K.jsxs)(`div`,{className:`grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]`,children:[(0,K.jsxs)(`section`,{children:[(0,K.jsx)(`p`,{className:`text-xs font-medium uppercase tracking-widest text-muted`,children:`Connect`}),(0,K.jsx)(`h1`,{className:`font-display text-3xl font-medium tracking-tight sm:text-4xl`,children:`Wire the workbook`}),(0,K.jsx)(`p`,{className:`mt-1 max-w-xl text-sm text-muted`,children:`Six steps from a blank spreadsheet to a daily Mangools pipeline your AI agents can drive.`}),(0,K.jsx)(`ol`,{className:`mt-6 space-y-4`,children:An.map(e=>(0,K.jsxs)(`li`,{className:`flex gap-4 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]`,children:[(0,K.jsx)(`span`,{className:`font-display text-2xl text-subtle`,children:e.n}),(0,K.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,K.jsxs)(`div`,{className:`flex items-start justify-between gap-3`,children:[(0,K.jsx)(`h2`,{className:`font-display text-xl font-medium`,children:e.title}),(0,K.jsx)(`button`,{type:`button`,className:`size-10 shrink-0 rounded-md text-muted hover:bg-raised hover:text-accent`,onClick:()=>u(t=>({...t,[e.n]:!t[e.n]})),"aria-label":l[e.n]?`Mark incomplete`:`Mark complete`,children:(0,K.jsx)(h,{className:l[e.n]?`mx-auto size-5 text-good`:`mx-auto size-5`})})]}),(0,K.jsx)(`p`,{className:`mt-1 text-sm text-muted`,children:e.body}),e.href?(0,K.jsxs)(`a`,{href:e.href,target:`_blank`,rel:`noreferrer`,className:`mt-2 inline-flex h-10 items-center gap-1 text-sm text-accent`,children:[e.hrefLabel,(0,K.jsx)(y,{className:`size-3.5`})]}):null]})]},e.n))})]}),(0,K.jsxs)(`aside`,{className:`grid h-fit gap-4`,children:[(0,K.jsxs)(`form`,{className:`grid gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]`,onSubmit:e=>{e.preventDefault(),d()},children:[(0,K.jsx)(`h2`,{className:`font-display text-lg font-medium`,children:`Mangools key`}),(0,K.jsx)(mt,{label:`API token`,hint:`Browser only. The Apps Script stores its own copy in Script Properties.`,children:(0,K.jsx)(ft,{type:`password`,autoComplete:`off`,value:o,onChange:e=>s(e.target.value),placeholder:`Paste X-Access-Token`})}),(0,K.jsx)(mt,{label:`Home domain`,children:(0,K.jsx)(ft,{value:e.domain,onChange:e=>t({domain:e.target.value}),placeholder:`yoursite.com`})}),(0,K.jsx)(mt,{label:`Location`,children:(0,K.jsx)(`select`,{className:`h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]`,value:e.locationId,onChange:e=>t({locationId:Number(e.target.value)}),children:At.map(e=>(0,K.jsxs)(`option`,{value:e.id,children:[e.label,` (`,e.id,`)`]},e.id))})}),(0,K.jsx)(mt,{label:`Language`,children:(0,K.jsx)(`select`,{className:`h-10 w-full rounded-md bg-raised px-3 text-sm text-fg shadow-[var(--shadow-border)]`,value:e.languageId,onChange:e=>t({languageId:Number(e.target.value)}),children:jt.map(e=>(0,K.jsx)(`option`,{value:e.id,children:e.label},e.id))})}),(0,K.jsxs)(q,{type:`submit`,disabled:i||o.trim().length<8,children:[i?(0,K.jsx)(S,{className:`size-4 animate-spin`}):null,`Test quota`]}),n.live?(0,K.jsxs)(`p`,{className:`text-xs text-good`,children:[`Live · `,n.lookups.remaining,` lookups · `,n.serps.remaining,` SERPs · reset ~`,n.resetHours,`h`]}):(0,K.jsx)(`p`,{className:`text-xs text-muted`,children:`Demo quota until you test a key.`})]}),(0,K.jsxs)(`div`,{className:`rounded-2xl bg-raised p-4`,children:[(0,K.jsx)(`h2`,{className:`font-display text-lg font-medium`,children:`What the sheet stores`}),(0,K.jsxs)(`ul`,{className:`mt-2 space-y-1.5 text-sm text-muted`,children:[(0,K.jsxs)(`li`,{children:[(0,K.jsx)(J,{className:`mr-1`,children:`Settings`}),` location, domain, secrets, model`]}),(0,K.jsxs)(`li`,{children:[(0,K.jsx)(J,{className:`mr-1`,children:`Keywords`}),` seeds, metrics, opportunity, status`]}),(0,K.jsxs)(`li`,{children:[(0,K.jsx)(J,{className:`mr-1`,children:`Tracking`}),` SERPWatcher ranks and deltas`]}),(0,K.jsxs)(`li`,{children:[(0,K.jsx)(J,{className:`mr-1`,children:`Agents`}),` Scout → Brief playbook rows`]}),(0,K.jsxs)(`li`,{children:[(0,K.jsx)(J,{className:`mr-1`,children:`Log`}),` HTTP, credits, 429 backoffs`]})]}),(0,K.jsx)(q,{variant:`quiet`,size:`sm`,className:`mt-3`,onClick:()=>r(),children:`Reset demo ledger`})]})]})]})}function Mn({className:e=`size-7`}){return(0,K.jsxs)(`svg`,{viewBox:`0 0 32 32`,className:e,"aria-hidden":`true`,children:[(0,K.jsx)(`rect`,{width:`32`,height:`32`,rx:`8`,fill:`currentColor`,className:`text-raised`}),(0,K.jsx)(`circle`,{cx:`12`,cy:`17`,r:`7.2`,fill:`currentColor`,className:`text-accent`}),(0,K.jsx)(`circle`,{cx:`20`,cy:`17`,r:`7.2`,fill:`currentColor`,className:`text-accent`}),(0,K.jsx)(`circle`,{cx:`16`,cy:`12`,r:`7.4`,fill:`currentColor`,className:`text-accent`})]})}var Nn=[{id:`workspace`,label:`Sheet`,icon:x},{id:`agents`,label:`Agents`,icon:te},{id:`script`,label:`Apps Script`,icon:g},{id:`atlas`,label:`API`,icon:m},{id:`setup`,label:`Setup`,icon:b}];function Pn({children:e}){let t=Z(e=>e.view),n=Z(e=>e.setView),r=Z(e=>e.quota),i=!!Z(e=>e.settings.apiKey);return(0,K.jsxs)(`div`,{className:`flex min-h-dvh flex-col bg-bg text-fg`,children:[(0,K.jsxs)(`header`,{className:`sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm`,children:[(0,K.jsxs)(`div`,{className:`mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 sm:px-6`,children:[(0,K.jsxs)(`button`,{type:`button`,className:`flex min-h-11 items-center gap-2.5`,onClick:()=>n(`workspace`),children:[(0,K.jsx)(Mn,{className:`size-8`}),(0,K.jsx)(`span`,{className:`font-display text-xl font-medium tracking-tight`,children:`Canopy`})]}),(0,K.jsx)(`nav`,{className:`ml-2 hidden items-center gap-1 md:flex`,children:Nn.map(e=>(0,K.jsxs)(`button`,{type:`button`,onClick:()=>n(e.id),className:G(`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium`,t===e.id?`bg-raised text-fg`:`text-muted hover:text-fg`),children:[(0,K.jsx)(e.icon,{className:`size-4`,strokeWidth:1.75}),e.label]},e.id))}),(0,K.jsxs)(`div`,{className:`ml-auto flex items-center gap-2`,children:[(0,K.jsxs)(`div`,{className:`hidden items-center gap-3 rounded-md bg-raised px-3 py-1.5 text-xs tabular-nums text-muted shadow-[var(--shadow-border)] sm:flex`,children:[(0,K.jsxs)(`span`,{children:[`Lookups`,` `,(0,K.jsxs)(`b`,{className:`font-medium text-fg`,children:[r.lookups.remaining,`/`,r.lookups.limit]})]}),(0,K.jsx)(`span`,{className:`text-subtle`,children:`·`}),(0,K.jsxs)(`span`,{children:[`SERP`,` `,(0,K.jsxs)(`b`,{className:`font-medium text-fg`,children:[r.serps.remaining,`/`,r.serps.limit]})]})]}),(0,K.jsx)(q,{size:`sm`,variant:i?`ghost`:`primary`,onClick:()=>n(`setup`),children:i?`Connected`:`Connect Mangools`})]})]}),(0,K.jsx)(`div`,{className:`flex gap-1 overflow-x-auto px-3 pb-2 md:hidden`,children:Nn.map(e=>(0,K.jsxs)(`button`,{type:`button`,onClick:()=>n(e.id),className:G(`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium`,t===e.id?`bg-raised text-fg`:`text-muted`),children:[(0,K.jsx)(e.icon,{className:`size-4`,strokeWidth:1.75}),e.label]},e.id))})]}),(0,K.jsx)(`main`,{className:`mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 py-5 sm:px-6 sm:py-6`,children:e})]})}function Fn({values:e,className:t}){let n=bt(e);return n?(0,K.jsx)(`svg`,{viewBox:`0 0 72 22`,className:t??`h-5 w-[72px]`,"aria-hidden":`true`,children:(0,K.jsx)(`path`,{d:n,fill:`none`,stroke:`currentColor`,strokeWidth:`1.6`,className:`text-ink-muted`})}):(0,K.jsx)(`span`,{className:`text-subtle`,children:`—`})}var In=[{id:`keywords`,label:`Keywords`},{id:`related`,label:`Related`},{id:`tracking`,label:`Tracking`},{id:`competitors`,label:`Competitors`},{id:`gaps`,label:`Gaps`},{id:`lists`,label:`Lists`},{id:`log`,label:`Log`}];function Ln(){let e=Z(e=>e.sheetTab),t=Z(e=>e.setSheetTab),n=Z(e=>e.keywords),r=Z(e=>e.related);Z(e=>e.tracking);let i=Z(e=>e.competitors),a=Z(e=>e.gaps),o=Z(e=>e.lists),s=Z(e=>e.log),l=Z(e=>e.selected),u=Z(e=>e.settings),d=Z(e=>e.addSeeds),ee=Z(e=>e.toggleSelected),[f,p]=(0,X.useState)(``),[m,h]=(0,X.useState)(null),[g,_]=(0,X.useState)(``),[v,y]=(0,X.useState)({key:`opportunity`,dir:`desc`}),b=(0,X.useMemo)(()=>{let e=[...n];return e.sort((e,t)=>{let n=e[v.key],r=t[v.key],i=typeof n==`number`?n:String(n??``),a=typeof r==`number`?r:String(r??``);return i<a?v.dir===`asc`?-1:1:i>a?v.dir===`asc`?1:-1:0}),e},[n,v]);async function x(e,t){h(e);try{await t(),c.success(e+` complete`)}catch(e){c.error(e instanceof Error?e.message:`Request failed`)}finally{h(null)}}let w=n.filter(e=>l.includes(e.id)),te=(w.length?w:n).map(e=>e.keyword);return(0,K.jsxs)(`div`,{className:`flex flex-1 flex-col gap-4`,children:[(0,K.jsxs)(`div`,{className:`flex flex-wrap items-end justify-between gap-3`,children:[(0,K.jsxs)(`div`,{children:[(0,K.jsx)(`p`,{className:`text-xs font-medium uppercase tracking-widest text-muted`,children:`Workbook`}),(0,K.jsx)(`h1`,{className:`font-display text-3xl font-medium tracking-tight text-fg sm:text-4xl`,children:`Keyword ledger`}),(0,K.jsx)(`p`,{className:`mt-1 max-w-xl text-sm text-muted`,children:`Same tabs the Apps Script builds in Google Sheets. Demo data is loaded for northline.studio — connect Mangools to score live.`})]}),(0,K.jsxs)(`div`,{className:`flex flex-wrap gap-2`,children:[(0,K.jsxs)(q,{size:`sm`,variant:`ghost`,disabled:!!m,onClick:()=>x(`Bulk score`,()=>Dn(te)),children:[m===`Bulk score`?(0,K.jsx)(S,{className:`size-4 animate-spin`}):null,`Score list`]}),(0,K.jsx)(q,{size:`sm`,variant:`ghost`,disabled:!!m,onClick:()=>{let e=w[0]?.keyword??n[0]?.keyword;if(!e)return c.error(`Add a keyword first`);t(`related`),x(`Related`,()=>En(e))},children:`Expand related`}),(0,K.jsx)(q,{size:`sm`,variant:`paper`,onClick:()=>Z.getState().setView(`script`),children:`Copy Apps Script`})]})]}),(0,K.jsxs)(`form`,{className:`flex flex-col gap-2 sm:flex-row`,onSubmit:e=>{e.preventDefault();let t=f.split(/[,\n]/).map(e=>e.trim()).filter(Boolean);t.length&&(d(t),p(``),c.success(`Added ${t.length} seed${t.length===1?``:`s`}`))},children:[(0,K.jsx)(ft,{value:f,onChange:e=>p(e.target.value),placeholder:`Add seeds — comma or newline separated`,className:`sm:flex-1`}),(0,K.jsxs)(q,{type:`submit`,variant:`ghost`,children:[(0,K.jsx)(C,{className:`size-4`}),`Add to sheet`]})]}),(0,K.jsxs)(`div`,{className:`flex-1 overflow-hidden rounded-2xl bg-paper p-2 text-ink shadow-[var(--shadow-paper)]`,children:[(0,K.jsxs)(`div`,{className:`flex items-center gap-1 overflow-x-auto rounded-xl bg-ink/5 p-1`,children:[In.map(n=>(0,K.jsx)(`button`,{type:`button`,onClick:()=>t(n.id),className:G(`h-9 shrink-0 rounded-lg px-3 text-sm font-medium`,e===n.id?`bg-paper text-ink shadow-sm`:`text-ink-muted hover:text-ink`),children:n.label},n.id)),(0,K.jsxs)(`span`,{className:`ml-auto hidden px-2 text-xs text-ink-muted sm:inline`,children:[u.domain||`no domain`,` · loc `,u.locationId]})]}),(0,K.jsxs)(`div`,{className:`mt-2 max-h-[min(70vh,720px)] overflow-auto rounded-xl`,children:[e===`keywords`&&(0,K.jsx)(Rn,{rows:b,selected:l,onToggle:ee,sort:v,onSort:e=>y(t=>({key:e,dir:t.key===e&&t.dir===`desc`?`asc`:`desc`}))}),e===`related`&&(0,K.jsx)(zn,{rows:r}),e===`tracking`&&(0,K.jsx)(Bn,{}),e===`competitors`&&(0,K.jsxs)(`div`,{className:`p-3`,children:[(0,K.jsxs)(`form`,{className:`mb-3 flex gap-2`,onSubmit:e=>{e.preventDefault(),g.trim()&&x(`Competitor`,()=>On(g.trim()))},children:[(0,K.jsx)(ft,{value:g,onChange:e=>_(e.target.value),placeholder:`Competitor domain`,className:`bg-paper text-ink shadow-none ring-1 ring-rule`}),(0,K.jsx)(q,{type:`submit`,size:`sm`,children:`Pull keywords`})]}),(0,K.jsx)(Vn,{columns:[`Domain`,`Keyword`,`Volume`,`KD`,`CPC`,`Pos`],rows:i.map(e=>[e.domain,e.keyword,vt(e.volume),e.kd??`—`,yt(e.cpc),e.position??`—`])})]}),e===`gaps`&&(0,K.jsxs)(`div`,{className:`p-3`,children:[(0,K.jsx)(q,{size:`sm`,className:`mb-3`,onClick:()=>{let e=window.prompt(`Competitors, comma-separated (max 5)`)??``;x(`Gap analysis`,()=>kn(e.split(`,`)))},children:`Run gap analysis`}),(0,K.jsx)(Vn,{columns:[`Keyword`,`Volume`,`CPC`,`You`,`Competitor`,`Their pos`],rows:a.map(e=>[e.keyword,vt(e.volume),yt(e.cpc),e.yourPosition??`—`,e.competitor,e.competitorPosition])})]}),e===`lists`&&(0,K.jsx)(Vn,{columns:[`List`,`Keywords`,`Updated`],rows:o.map(e=>[e.name,e.count,e.updated])}),e===`log`&&(0,K.jsx)(Vn,{columns:[`When`,`Level`,`Action`,`Detail`,`Credits`],rows:s.map(e=>[e.at,e.level,e.action,e.detail,e.credits])})]})]})]})}function Rn({rows:e,selected:t,onToggle:n,sort:r,onSort:i}){let a=Z(e=>e.updateStatus);return(0,K.jsxs)(`table`,{className:`sheet-grid w-full min-w-[760px] border-collapse text-left text-sm`,children:[(0,K.jsx)(`thead`,{children:(0,K.jsxs)(`tr`,{className:`bg-paper text-ink-muted`,children:[(0,K.jsx)(`th`,{className:`w-10 px-3 py-2`}),[{key:`keyword`,label:`Keyword`},{key:`volume`,label:`Volume`},{key:`msv`,label:`Trend`},{key:`kd`,label:`KD`},{key:`cpc`,label:`CPC`},{key:`opportunity`,label:`Score`},{key:`status`,label:`Status`},{key:`agent`,label:`Agent`}].map(e=>(0,K.jsx)(`th`,{className:`px-3 py-2 font-medium`,children:(0,K.jsxs)(`button`,{type:`button`,onClick:()=>i(e.key),className:`hover:text-ink`,children:[e.label,r.key===e.key?r.dir===`desc`?` ↓`:` ↑`:``]})},e.key))]})}),(0,K.jsx)(`tbody`,{children:e.map((e,r)=>(0,K.jsxs)(`tr`,{className:G(`border-t border-rule`,r%2==1&&`bg-ink/5`,t.includes(e.id)&&`bg-accent/20`),children:[(0,K.jsx)(`td`,{className:`px-3 py-2`,children:(0,K.jsx)(`input`,{type:`checkbox`,className:`size-4 accent-ink`,checked:t.includes(e.id),onChange:()=>n(e.id),"aria-label":`Select ${e.keyword}`})}),(0,K.jsxs)(`td`,{className:`px-3 py-2`,children:[(0,K.jsx)(`div`,{className:`font-medium`,children:e.keyword}),(0,K.jsx)(`div`,{className:`text-xs text-ink-muted`,children:e.seed})]}),(0,K.jsx)(`td`,{className:`px-3 py-2 tabular-nums`,children:vt(e.volume)}),(0,K.jsx)(`td`,{className:`px-3 py-2`,children:(0,K.jsx)(Fn,{values:e.msv})}),(0,K.jsx)(`td`,{className:`px-3 py-2`,children:(0,K.jsx)(Hn,{kd:e.kd})}),(0,K.jsx)(`td`,{className:`px-3 py-2 tabular-nums`,children:yt(e.cpc)}),(0,K.jsx)(`td`,{className:`px-3 py-2 font-medium tabular-nums`,children:e.opportunity}),(0,K.jsx)(`td`,{className:`px-3 py-2`,children:(0,K.jsxs)(`select`,{value:e.status,onChange:t=>a(e.id,t.target.value),className:`h-8 rounded-sm bg-transparent text-xs`,children:[(0,K.jsx)(`option`,{value:`new`,children:`new`}),(0,K.jsx)(`option`,{value:`tracked`,children:`tracked`}),(0,K.jsx)(`option`,{value:`briefed`,children:`briefed`}),(0,K.jsx)(`option`,{value:`ignored`,children:`ignored`})]})}),(0,K.jsx)(`td`,{className:`px-3 py-2 text-ink-muted`,children:e.agent})]},e.id))})]})}function zn({rows:e}){return e.length?(0,K.jsx)(Vn,{columns:[`Seed`,`Keyword`,`Volume`,`KD`,`CPC`,`Score`],rows:e.map(e=>[e.seed,e.keyword,vt(e.volume),e.kd??`—`,yt(e.cpc),e.opportunity])}):(0,K.jsx)(`p`,{className:`p-6 text-sm text-ink-muted`,children:`Expand a seed to fill this tab.`})}function Bn(){let e=Z(e=>e.tracking);return(0,K.jsxs)(`table`,{className:`sheet-grid w-full min-w-[720px] border-collapse text-left text-sm`,children:[(0,K.jsx)(`thead`,{children:(0,K.jsx)(`tr`,{className:`bg-paper text-ink-muted`,children:[`Keyword`,`Loc`,`Device`,`Rank`,`Change`,`Best`,`Visits`,`URL`].map(e=>(0,K.jsx)(`th`,{className:`px-3 py-2 font-medium`,children:e},e))})}),(0,K.jsx)(`tbody`,{children:e.map((e,t)=>{let n=_t(e.rank,e.prev);return(0,K.jsxs)(`tr`,{className:G(`border-t border-rule`,t%2==1&&`bg-ink/5`),children:[(0,K.jsx)(`td`,{className:`px-3 py-2 font-medium`,children:e.keyword}),(0,K.jsx)(`td`,{className:`px-3 py-2 text-ink-muted`,children:e.location}),(0,K.jsx)(`td`,{className:`px-3 py-2`,children:e.device}),(0,K.jsx)(`td`,{className:`px-3 py-2 tabular-nums`,children:e.rank??`—`}),(0,K.jsx)(`td`,{className:`px-3 py-2`,children:(0,K.jsxs)(`span`,{className:G(`inline-flex items-center gap-0.5 tabular-nums`,n>0&&`text-good`,n<0&&`text-bad`),children:[n>0?(0,K.jsx)(p,{className:`size-3.5`}):null,n<0?(0,K.jsx)(f,{className:`size-3.5`}):null,n===0?`—`:Math.abs(n)]})}),(0,K.jsx)(`td`,{className:`px-3 py-2 tabular-nums`,children:e.best??`—`}),(0,K.jsx)(`td`,{className:`px-3 py-2 tabular-nums`,children:e.visits}),(0,K.jsx)(`td`,{className:`max-w-[180px] truncate px-3 py-2 text-ink-muted`,children:e.url})]},e.id)})})]})}function Vn({columns:e,rows:t}){return t.length?(0,K.jsxs)(`table`,{className:`sheet-grid w-full min-w-[640px] border-collapse text-left text-sm`,children:[(0,K.jsx)(`thead`,{children:(0,K.jsx)(`tr`,{className:`bg-paper text-ink-muted`,children:e.map(e=>(0,K.jsx)(`th`,{className:`px-3 py-2 font-medium`,children:e},e))})}),(0,K.jsx)(`tbody`,{children:t.map((e,t)=>(0,K.jsx)(`tr`,{className:G(`border-t border-rule`,t%2==1&&`bg-ink/5`),children:e.map((e,t)=>(0,K.jsx)(`td`,{className:G(`px-3 py-2`,t===0&&`font-medium`),children:e},t))},t))})]}):(0,K.jsx)(`p`,{className:`p-6 text-sm text-ink-muted`,children:`Nothing on this tab yet.`})}function Hn({kd:e}){let t=gt(e);return(0,K.jsxs)(`div`,{className:`flex min-w-16 items-center gap-2`,children:[(0,K.jsx)(`span`,{className:`w-6 tabular-nums`,children:e??`—`}),(0,K.jsx)(`span`,{className:`kd-bar w-12`,children:(0,K.jsx)(`span`,{style:{width:`${e==null?0:Math.min(100,e)}%`},className:G(t===`good`&&`bg-good`,t===`warn`&&`bg-warn`,t===`bad`&&`bg-bad`,t===`muted`&&`bg-rule`)})})]})}function Un(){let e=Z(e=>e.view);return(0,X.useEffect)(()=>{Z.persist.rehydrate()},[]),(0,K.jsxs)(Pn,{children:[e===`workspace`?(0,K.jsx)(Ln,{}):null,e===`agents`?(0,K.jsx)(tn,{}):null,e===`script`?(0,K.jsx)(hn,{}):null,e===`atlas`?(0,K.jsx)(cn,{}):null,e===`setup`?(0,K.jsx)(jn,{}):null]})}export{Un as component};