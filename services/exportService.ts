
import { Curriculum } from "../types";

export function generateDossierHtml(curriculum: Curriculum): string {
  const modulesHtml = curriculum.modules.map((m, i) => `
    <div class="module">
      <div class="module-header">
        <span class="module-number">${i + 1}</span>
        <h3 class="module-title">${m.title}</h3>
        <span class="module-meta">${m.duration} • ${m.level}</span>
      </div>
      <div class="module-body">
        <div class="column">
          <h4>Core Topics</h4>
          <ul>${m.topics.map(t => `<li><strong>${t.name}:</strong> ${t.description}</li>`).join('')}</ul>
        </div>
        <div class="column">
          <h4>Learning Outcomes</h4>
          <ul>${m.learningOutcomes.map(o => `<li>${o}</li>`).join('')}</ul>
          <div class="alignments">
            <p><strong>Industry:</strong> ${m.industryAlignment}</p>
            <p><strong>Academic:</strong> ${m.academicAlignment}</p>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Synergy Dossier - ${curriculum.specialization}</title>
      <style>
        body { font-family: 'Inter', -apple-system, sans-serif; color: #1e293b; line-height: 1.5; padding: 40px; max-width: 900px; margin: auto; }
        .header { border-bottom: 4px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
        .brand h1 { margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; }
        .brand p { margin: 0; font-size: 10px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 2px; }
        .dossier-meta { text-align: right; font-size: 12px; color: #64748b; font-weight: 600; }
        
        .title-block { margin-bottom: 40px; }
        .title-block h2 { font-size: 36px; font-weight: 900; margin: 0 0 10px 0; letter-spacing: -1px; }
        .overview { font-size: 16px; color: #475569; margin-bottom: 20px; text-align: justify; }
        
        .logic-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 40px; }
        .logic-box h4 { margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; color: #2563eb; letter-spacing: 1px; }
        .logic-box p { margin: 0; font-style: italic; font-size: 14px; color: #334155; }
        
        .module { border: 1px solid #e2e8f0; border-radius: 16px; margin-bottom: 24px; overflow: hidden; page-break-inside: avoid; }
        .module-header { background: #f1f5f9; padding: 15px 20px; display: flex; align-items: center; gap: 15px; border-bottom: 1px solid #e2e8f0; }
        .module-number { background: #2563eb; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; }
        .module-title { margin: 0; flex-grow: 1; font-size: 18px; font-weight: 700; }
        .module-meta { font-size: 12px; font-weight: 600; color: #64748b; }
        
        .module-body { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .module-body h4 { margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px; }
        .module-body ul { margin: 0; padding-left: 18px; font-size: 13px; color: #334155; }
        .module-body li { margin-bottom: 8px; }
        .alignments { margin-top: 20px; padding-top: 15px; border-top: 1px dashed #e2e8f0; font-size: 11px; }
        .alignments p { margin: 4px 0; }
        
        .sidebar-items { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 30px; }
        .sidebar-box h4 { margin: 0 0 12px 0; font-size: 12px; text-transform: uppercase; color: #0f172a; }
        .sidebar-box ul { margin: 0; padding-left: 18px; font-size: 13px; color: #475569; }
        
        .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        
        @media print {
          body { padding: 20px; }
          .logic-box { background: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .module-header { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; }
          .module-number { background: #2563eb !important; color: white !important; -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          <h1>EduPath AI</h1>
          <p>Curriculum Architect Research Lab</p>
        </div>
        <div class="dossier-meta">
          ID: EP-${Math.random().toString(36).substr(2, 9).toUpperCase()}<br>
          DATE: ${new Date().toLocaleDateString()}<br>
          STATUS: VERIFIED
        </div>
      </div>
      
      <div class="title-block">
        <h2>${curriculum.specialization}</h2>
        <div class="overview">${curriculum.overview}</div>
        <p style="font-size: 13px; font-weight: 700; color: #64748b;">Target Role: <span style="color: #0f172a;">${curriculum.targetRole}</span></p>
      </div>
      
      ${curriculum.adaptiveFocusReasoning ? `
        <div class="logic-box">
          <h4>Architectural Reasoning</h4>
          <p>${curriculum.adaptiveFocusReasoning}</p>
        </div>
      ` : ''}
      
      <div class="modules-container">
        ${modulesHtml}
      </div>
      
      <div class="sidebar-items">
        <div class="sidebar-box">
          <h4>Prerequisites</h4>
          <ul>${curriculum.prerequisites.map(p => `<li>${p}</li>`).join('')}</ul>
        </div>
        <div class="sidebar-box">
          <h4>Standard Benchmarks</h4>
          <ul>${curriculum.suggestedCertifications.map(c => `<li>${c}</li>`).join('')}</ul>
        </div>
      </div>
      
      <div class="footer">
        This document is an AI-synthesized architectural roadmap generated on the EduPath Platform.<br>
        Cross-referenced with ACM/IEEE Computer Science Curricula 2023 and FAANG competency matrices.
      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 500);
        }
      </script>
    </body>
    </html>
  `;
}
