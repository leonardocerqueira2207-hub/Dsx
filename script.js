// DSX Energia - App completo (localStorage + import/export + charts)
dayjs.extend(window.dayjs_plugin_isoWeek);
dayjs.extend(window.dayjs_plugin_customParseFormat);

// --- Storage helpers ---
const LS_KEY = "podas_registros_v1";
function loadRegistros(){ try{ const raw=localStorage.getItem(LS_KEY); if(!raw) return []; const arr=JSON.parse(raw); return Array.isArray(arr)?arr:[] }catch(e){ console.error("Erro ao carregar registros:", e); return [] } }
function saveRegistros(data){ localStorage.setItem(LS_KEY, JSON.stringify(data)); }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

// --- App state ---
const state={ empresa:"EMS", perfil:"Operador", mes:dayjs().month(), ano:dayjs().year(), editId:null };

// --- UI elements ---
const empresaSel=document.getElementById("empresaSel");
const mesSel=document.getElementById("mesSel");
const anoSel=document.getElementById("anoSel");
const perfilChip=document.getElementById("perfilChip");
const sairBtn=document.getElementById("sairBtn");

const kpiPoda=document.getElementById("kpiPoda");
const kpiEspacador=document.getElementById("kpiEspacador");
const kpiMedia=document.getElementById("kpiMedia");

// --- controle de visibilidade por perfil ---
if(perfil === "Operador"){
  // Operador só pode ver Consultar e Dashboard
  novoBtn.style.display = "none";
  importarBtn.style.display = "none";
  exportarBtn.style.display = "none";
} else {
  // Gestor vê tudo
  novoBtn.style.display = "";
  importarBtn.style.display = "";
  exportarBtn.style.display = "";
}

const fileInput=document.getElementById("fileInput");

const telaNovo=document.getElementById("telaNovo");
const telaConsultar=document.getElementById("telaConsultar");
const telaDashboard=document.getElementById("telaDashboard");

const formRegistro=document.getElementById("formRegistro");
const dataRegistro=document.getElementById("dataRegistro");
const tipo=document.getElementById("tipo");
const quantidade=document.getElementById("quantidade");
const observacoes=document.getElementById("observacoes");
const cancelarNovo=document.getElementById("cancelarNovo");

const filtroDe=document.getElementById("filtroDe");
const filtroAte=document.getElementById("filtroAte");
const filtroTipo=document.getElementById("filtroTipo");
const aplicarFiltro=document.getElementById("aplicarFiltro");
const limparFiltro=document.getElementById("limparFiltro");
const tbodyRegistros=document.getElementById("tbodyRegistros");

const loginOverlay=document.getElementById("loginOverlay");
const empresaLogin=document.getElementById("empresaLogin");
const perfilLogin=document.getElementById("perfilLogin");
const senhaFld=document.getElementById("senhaFld");
const senhaLogin=document.getElementById("senhaLogin");
const entrarBtn=document.getElementById("entrarBtn");

const toast=document.getElementById("toast");
let chartDia, chartTipo;

// --- Helpers UI ---
function showToast(msg){ toast.textContent=msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"),2000); }
function setPanel(panel){ [telaNovo,telaConsultar,telaDashboard].forEach(p=>p.classList.add("hidden")); if(panel==="novo")telaNovo.classList.remove("hidden"); if(panel==="consultar")telaConsultar.classList.remove("hidden"); if(panel==="dashboard")telaDashboard.classList.remove("hidden"); }
function refreshSelects(){
  const meses=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  mesSel.innerHTML=meses.map((m,idx)=>`<option value="${idx}">${m}</option>`).join(""); mesSel.value=state.mes;
  const y=dayjs().year(); const anos=Array.from({length:11},(_,i)=>y-5+i);
  anoSel.innerHTML=anos.map(a=>`<option value="${a}">${a}</option>`).join(""); anoSel.value=state.ano;
  empresaSel.value=state.empresa; perfilChip.textContent=`Perfil: ${state.perfil}`;
}

function summarize(regs){
  const inicio=dayjs(`${state.ano}-${String(state.mes+1).padStart(2,"0")}-01`);
  const fim=inicio.endOf("month");
  const doMes=regs.filter(r=>r.empresa===state.empresa && dayjs(r.data).isAfter(inicio.subtract(1,"day")) && dayjs(r.data).isBefore(fim.add(1,"day")));
  const somaPoda=doMes.filter(r=>r.tipo==="Poda de Árvore").reduce((acc,r)=>acc+Number(r.quantidade||0),0);
  const somaEsp=doMes.filter(r=>r.tipo==="Instalação de Espaçador").reduce((acc,r)=>acc+Number(r.quantidade||0),0);
  const diasComRegistro=new Set(doMes.map(r=>dayjs(r.data).format("YYYY-MM-DD")));
  const media=(somaPoda+somaEsp)/Math.max(diasComRegistro.size,1);
  kpiPoda.textContent=somaPoda.toLocaleString("pt-BR");
  kpiEspacador.textContent=somaEsp.toLocaleString("pt-BR");
  kpiMedia.textContent=media.toFixed(1);
}

function renderTabela(){
  const regs=loadRegistros().filter(r=>r.empresa===state.empresa);
  let subset=[...regs];
  const de=filtroDe.value?dayjs(filtroDe.value):null;
  const ate=filtroAte.value?dayjs(filtroAte.value):null;
  const tipoV=filtroTipo.value;
  if(de) subset=subset.filter(r=>dayjs(r.data).isAfter(de.subtract(1,"day")));
  if(ate) subset=subset.filter(r=>dayjs(r.data).isBefore(dayjs(ate).add(1,"day")));
  if(tipoV) subset=subset.filter(r=>r.tipo===tipoV);
  subset.sort((a,b)=>dayjs(b.data).valueOf()-dayjs(a.data).valueOf());
  tbodyRegistros.innerHTML=subset.map(r=>{
    const dt=dayjs(r.data).format("DD/MM/YYYY");
    const q=Number(r.quantidade||0).toLocaleString("pt-BR");
    const obs=r.observacoes||"";
    const canEdit=state.perfil==="Gestor";
    return `<tr>
      <td>${dt}</td>
      <td>${r.tipo}</td>
      <td>${q}</td>
      <td>${obs}</td>
      <td>${canEdit?`<button class="btn" data-edit="${r.id}">Editar</button>`:""} ${canEdit?`<button class="btn ghost" data-del="${r.id}">Excluir</button>`:""}</td>
    </tr>`;
  }).join("");
  tbodyRegistros.querySelectorAll("[data-edit]").forEach(btn=>btn.addEventListener("click",()=>startEdit(btn.getAttribute("data-edit"))));
  tbodyRegistros.querySelectorAll("[data-del]").forEach(btn=>btn.addEventListener("click",()=>delRegistro(btn.getAttribute("data-del"))));
}

function rebuildCharts(){
  const regs=loadRegistros().filter(r=>r.empresa===state.empresa);
  const inicio=dayjs(`${state.ano}-${String(state.mes+1).padStart(2,"0")}-01`);
  const fim=inicio.endOf("month");
  const doMes=regs.filter(r=>dayjs(r.data).isAfter(inicio.subtract(1,"day")) && dayjs(r.data).isBefore(fim.add(1,"day")));
  const porDia={};
  doMes.forEach(r=>{ const d=dayjs(r.data).format("YYYY-MM-DD"); porDia[d]=(porDia[d]||0)+Number(r.quantidade||0); });
  const labelsDia=Object.keys(porDia).sort();
  const dataDia=labelsDia.map(k=>porDia[k]);
  const somaPoda=doMes.filter(r=>r.tipo==="Poda de Árvore").reduce((a,r)=>a+Number(r.quantidade||0),0);
  const somaEsp=doMes.filter(r=>r.tipo==="Instalação de Espaçador").reduce((a,r)=>a+Number(r.quantidade||0),0);
  if(chartDia) chartDia.destroy(); if(chartTipo) chartTipo.destroy();
  chartDia=new Chart(document.getElementById("chartDia"),{ type:"line", data:{ labels:labelsDia.map(l=>dayjs(l).format("DD/MM")), datasets:[{ label:"Total por dia", data:dataDia }] }, options:{ responsive:true, plugins:{ legend:{ display:true } }, scales:{ y:{ beginAtZero:true } } } });
  chartTipo=new Chart(document.getElementById("chartTipo"),{ type:"bar", data:{ labels:["Poda de Árvore","Instalação de Espaçador"], datasets:[{ label:"Quantidade", data:[somaPoda, somaEsp] }] }, options:{ responsive:true, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true } } } });
}

// --- CRUD ---
function addRegistro(payload){ const regs=loadRegistros(); regs.push({ id:uid(), empresa:state.empresa, ...payload }); saveRegistros(regs); summarize(regs); showToast("Registro salvo!"); }
function startEdit(id){ const regs=loadRegistros(); const found=regs.find(r=>r.id===id); if(!found) return; state.editId=id; setPanel("novo"); dataRegistro.value=dayjs(found.data).format("YYYY-MM-DD"); tipo.value=found.tipo; quantidade.value=found.quantidade; observacoes.value=found.observacoes||""; }
function updateRegistro(payload){ const regs=loadRegistros(); const idx=regs.findIndex(r=>r.id===state.editId); if(idx>=0){ regs[idx]={ ...regs[idx], ...payload }; saveRegistros(regs); showToast("Registro atualizado!"); } state.editId=null; }
function delRegistro(id){ if(!confirm("Confirmar exclusão?")) return; const regs=loadRegistros().filter(r=>r.id!==id); saveRegistros(regs); renderTabela(); summarize(regs); rebuildCharts(); showToast("Registro excluído."); }

// --- Import/Export ---
function parseCSV(text){
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return [];
  const header=lines[0].split(/;|,|\t/).map(h=>h.trim().toLowerCase());
  const idxData=header.findIndex(h=>h.includes("data"));
  const idxTipo=header.findIndex(h=>h.includes("tipo"));
  const idxQtd=header.findIndex(h=>h.includes("quant"));
  const idxObs=header.findIndex(h=>h.includes("obser"));
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].split(/;|,|\t/);
    rows.push({
      data:dayjs(cols[idxData]?.trim(),["YYYY-MM-DD","DD/MM/YYYY","D/M/YYYY"]).format("YYYY-MM-DD"),
      tipo:(cols[idxTipo]||"").trim()||"Poda de Árvore",
      quantidade:Number((cols[idxQtd]||"0").toString().replace(",",".")),
      observacoes:(cols[idxObs]||"").trim(),
    });
  }
  return rows;
}
function handleFile(file){
  const name=file.name.toLowerCase();
  if(name.endsWith(".csv")){
    const reader=new FileReader();
    reader.onload=e=>importRows(parseCSV(e.target.result));
    reader.readAsText(file,"utf-8");
  }else{
    const reader=new FileReader();
    reader.onload=e=>{
      const data=new Uint8Array(e.target.result);
      const wb=XLSX.read(data,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const json=XLSX.utils.sheet_to_json(ws,{defval:""});
      const rows=json.map(obj=>{
        const d=obj.data||obj.Data||obj["data do registro"]||obj["Data"]||obj["DATA"];
        const t=obj.tipo||obj.Tipo||obj["TIPO"];
        const q=obj.quantidade||obj["Quantidade"]||obj["QTD"]||obj["qtd"];
        const o=obj.observacoes||obj["Observações"]||obj["OBS"]||obj["obs"];
        return {
          data:dayjs(String(d).trim(),["YYYY-MM-DD","DD/MM/YYYY","D/M/YYYY"]).format("YYYY-MM-DD"),
          tipo:(t||"Poda de Árvore").toString().trim(),
          quantidade:Number(String(q).replace(",","."))||0,
          observacoes:(o||"").toString().trim(),
        };
      });
      importRows(rows);
    };
    reader.readAsArrayBuffer(file);
  }
}
function importRows(rows){
  if(!Array.isArray(rows)||!rows.length){ showToast("Arquivo vazio ou cabeçalho inválido."); return; }
  const regs=loadRegistros();
  let count=0;
  rows.forEach(r=>{
    if(!r.data||isNaN(new Date(r.data).getTime())) return;
    regs.push({ id:uid(), empresa:state.empresa, ...r });
    count++;
  });
  saveRegistros(regs);
  showToast(`${count} registros importados para ${state.empresa}.`);
  summarize(regs); renderTabela(); rebuildCharts();
}
function exportCSV(){
  const regs=loadRegistros().filter(r=>r.empresa===state.empresa);
  if(!regs.length){ showToast("Nada para exportar."); return; }
  const header="data;tipo;quantidade;observacoes\n";
  const lines=regs.map(r=>{
    const d=dayjs(r.data).format("YYYY-MM-DD");
    const t=r.tipo;
    const q=Number(r.quantidade||0);
    const o=(r.observacoes||"").replace(/[\r\n]+/g," ").replace(/;/g,",");
    return `${d};${t};${q};${o}`;
  });
  const blob=new Blob([header+lines.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download=`${state.empresa}_registros.csv`; a.click();
  URL.revokeObjectURL(url);
}

// --- Seed + Boot ---
function seedIfEmpty(){
  const regs=loadRegistros();
  if(regs.length) return;
  const today=dayjs();
  const sample=[
    { data: today.subtract(4,"day").format("YYYY-MM-DD"), tipo: "Poda de Árvore", quantidade: 12, observacoes: "Equipe A" },
    { data: today.subtract(3,"day").format("YYYY-MM-DD"), tipo: "Instalação de Espaçador", quantidade: 7, observacoes: "Equipe B" },
    { data: today.subtract(2,"day").format("YYYY-MM-DD"), tipo: "Poda de Árvore", quantidade: 9, observacoes: "" },
    { data: today.subtract(1,"day").format("YYYY-MM-DD"), tipo: "Instalação de Espaçador", quantidade: 5, observacoes: "Área urbana" },
  ];
  const out=sample.map(s=>({ id:uid(), empresa:"EMS", ...s }));
  saveRegistros(out);
}
function updateAll(){ const regs=loadRegistros(); summarize(regs); if(!telaConsultar.classList.contains("hidden")) renderTabela(); if(!telaDashboard.classList.contains("hidden")) rebuildCharts(); }

// --- Events ---
empresaSel.addEventListener("change",()=>{ state.empresa=empresaSel.value; updateAll(); });
mesSel.addEventListener("change",()=>{ state.mes=Number(mesSel.value); updateAll(); });
anoSel.addEventListener("change",()=>{ state.ano=Number(anoSel.value); updateAll(); });
sairBtn.addEventListener("click",()=>{ loginOverlay.style.display="flex"; });

novoBtn.addEventListener("click",()=>{ if(state.perfil!=="Operador" && state.perfil!=="Gestor") return; setPanel("novo"); });
consultarBtn.addEventListener("click",()=>{ setPanel("consultar"); renderTabela(); });
dashboardBtn.addEventListener("click",()=>{ setPanel("dashboard"); rebuildCharts(); });

importarBtn.addEventListener("click",()=>{ if(state.perfil!=="Gestor"){ showToast("Apenas Gestor pode importar."); return; } fileInput.click(); });
fileInput.addEventListener("change",(e)=>{ if(!e.target.files?.length) return; handleFile(e.target.files[0]); fileInput.value=""; });
exportarBtn.addEventListener("click",()=>{ if(state.perfil!=="Gestor"){ showToast("Apenas Gestor pode exportar."); return; } exportCSV(); });

formRegistro.addEventListener("submit",(e)=>{
  e.preventDefault();
  if(state.perfil==="Operador" || state.perfil==="Gestor"){
    const payload={ data:dataRegistro.value, tipo:tipo.value, quantidade:Number(quantidade.value||0), observacoes:observacoes.value.trim() };
    if(state.editId){ updateRegistro(payload); } else { addRegistro(payload); }
    formRegistro.reset(); setPanel(null); rebuildCharts(); renderTabela();
  }else{
    showToast("Faça login para registrar.");
  }
});
cancelarNovo.addEventListener("click",()=>{ state.editId=null; formRegistro.reset(); setPanel(null); });

aplicarFiltro.addEventListener("click",renderTabela);
limparFiltro.addEventListener("click",()=>{ filtroDe.value=""; filtroAte.value=""; filtroTipo.value=""; renderTabela(); });

perfilLogin.addEventListener("change",()=>{ senhaFld.style.display = perfilLogin.value==="Gestor" ? "flex" : "none"; });
entrarBtn.addEventListener("click",()=>{
  const empresa=empresaLogin.value; const perfil=perfilLogin.value;
  if(perfil==="Gestor"){ if(senhaLogin.value!=="Leonardo123"){ showToast("Senha do Gestor incorreta."); return; } }
  state.empresa=empresa; state.perfil=perfil;
  refreshSelects(); updateAll(); loginOverlay.style.display="none"; showToast(`Bem-vindo, ${perfil}!`);
});

(function init(){ seedIfEmpty(); refreshSelects(); updateAll(); })();
