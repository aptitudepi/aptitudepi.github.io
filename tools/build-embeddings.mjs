import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(__dirname, '..');

// Helper to strip HTML tags cleanly
function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse certifications CSV properly handling quotes
function parseCertifications() {
  const csvPath = resolve(SITE, 'assets', 'certifications.csv');
  const content = readFileSync(csvPath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  lines.shift(); // Remove header

  const certsByCat = {
    cybersecurity: [],
    cloud_ai: [],
    dev_software: [],
    defense_industry: []
  };

  lines.forEach(line => {
    const cols = [];
    let inQuote = false;
    let cur = '';
    for (let c of line) {
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === ',' && !inQuote) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur.trim());

    const name = cols[0] ? cols[0].replace(/^"|"$/g, '') : '';
    const authority = cols[2] ? cols[2].replace(/^"|"$/g, '') : '';
    const date = cols[3] || cols[4] || '';

    if (!name) return;

    const certStr = `${name} (${authority}${date ? ', ' + date : ''})`;

    const authLower = authority.toLowerCase();
    const nameLower = name.toLowerCase();

    if (
      authLower.includes('giac') ||
      authLower.includes('cisco') ||
      authLower.includes('isc2') ||
      authLower.includes('infosec') ||
      authLower.includes('apisec') ||
      authLower.includes('comptia') ||
      nameLower.includes('cyber') ||
      nameLower.includes('security')
    ) {
      certsByCat.cybersecurity.push(certStr);
    } else if (
      authLower.includes('microsoft') ||
      authLower.includes('nvidia') ||
      authLower.includes('deeplearning') ||
      authLower.includes('datacamp') ||
      authLower.includes('google') ||
      nameLower.includes('ai') ||
      nameLower.includes('azure') ||
      nameLower.includes('machine learning')
    ) {
      certsByCat.cloud_ai.push(certStr);
    } else if (
      authLower.includes('lockheed') ||
      authLower.includes('palantir') ||
      authLower.includes('scaled agile') ||
      authLower.includes('project management') ||
      authLower.includes('correlation one') ||
      authLower.includes('pilot institute')
    ) {
      certsByCat.defense_industry.push(certStr);
    } else {
      certsByCat.dev_software.push(certStr);
    }
  });

  return certsByCat;
}

// Define comprehensive knowledge chunks
function buildChunks() {
  const certs = parseCertifications();

  const chunks = [
    {
      title: 'Profile, Education & Honors',
      text: 'Devkumar Banerjee is a Computer Science and Engineering student at Texas A&M University (College Station, TX), graduating May 2029. He is a Craig and Galen Brown Engineering Honors student, University Honors student, National Merit Finalist (top 15,000 of 1.3M applicants), and Brown Foundation Scholar (top 0.5%). Contact: devkumar@tamu.edu | LinkedIn: linkedin.com/in/dvkb | GitHub: github.com/aptitudepi | Site: dvxb.io'
    },
    {
      title: 'Lockheed Martin — AI Systems / SRE Intern',
      text: 'At Lockheed Martin (May 2026 -- Present), Devkumar is an AI Systems / Site Reliability Engineer (SRE) Intern in Houston, TX. He is architecting an AI agent system with the Splunk Delivery Team to automate event triage, alert correlation, and root cause analysis across production systems, with automated remediation pipelines to reduce MTTR and manual investigation time. Previously (May--Aug 2025), he automated Splunk app deployment using Ansible across one of industry largest Splunk environments, cutting ops time by 95%.'
    },
    {
      title: 'UT MD Anderson Cancer Center — Data Research Intern',
      text: 'Devkumar was selected for the prestigious UT MD Anderson Cancer Center Data Research Internship in Houston, TX (June 2026 -- Present), achieving a top 0.2% selectivity rate (1 of 6 selected from 3,000+ applicants). He builds retrospective patient cohorts by programmatically screening and filtering large-scale Epic EHR data based on genomic risk scores and clinical staging criteria. He also developed the PCPG Analyzer transcriptome bio-analysis framework.'
    },
    {
      title: 'Texas A&M DIVE Lab & AGGIES Lab Research',
      text: 'Devkumar is an Undergraduate Researcher at Texas A&M DIVE Lab under PI Dr. Shuiwang Ji (Jan 2026 -- Present), building physics-informed spatiotemporal graph neural networks (PyTorch Geometric) for phase-transition dynamics in polycrystalline alloys. His noise-regularization module reduced 1-step prediction error by 2.2x and validation loss by 27%. At AGGIES Lab under Dr. Shreyas Kumar (May 2025 -- Present), he analyzes ICS/OT security benchmarks (SWaT/WADI).'
    },
    {
      title: 'Project — The Aggie Map',
      text: 'The Aggie Map (HowdyHack 2025, Best Aggie Hack): Interactive campus navigation monorepo built with full-stack FastAPI and Next.js, deployed to DigitalOcean. Provides real-time building routes, accessible pathways, and campus location search.'
    },
    {
      title: 'Project — AI Voice MFA',
      text: 'AI Voice MFA (TAMUHack X, Best Beginner Hardware Hack, 4th/1000+): Hardware voice authentication security system built with Raspberry Pi, ESP8266 microcontroller, and a Convolutional Neural Network (CNN) voice biometric verification model.'
    },
    {
      title: 'Project — Hospital Plunge & PCPG Analyzer',
      text: 'Hospital Plunge (TAMU Datathon 2023, 3rd/600+): Hospital patient length-of-stay prediction pipeline using CNNs with K-fold cross-validation and Principal Component Analysis (PCA). PCPG Analyzer: Dynamic Python/Streamlit web framework for transcriptome bio-analysis of Pheochromocytoma & Paraganglioma cancer data at UT MD Anderson.'
    },
    {
      title: 'Project — Doctor-Robot',
      text: 'Doctor-Robot (TIDALHack): AI clinical symptom classifier and triage engine powered by XGBoost machine learning and Groq LLM inference for fast diagnostic assistance.'
    },
    {
      title: 'Publications & Presentations',
      text: 'Publication & Presentation: "Benchmarking Performance of Machine Learning Algorithms for Fluid Flow Simulation by Leveraging Cluster Computing: A Case Study for High-Performance Computing" presented at the NASA Thermal and Fluids Analysis Workshop (TFAWS 2022). Benchmarked Raspberry Pi clusters using SLURM for IoT machine learning workloads.'
    },
    {
      title: 'Teaching, Outreach & Community Service',
      text: 'Teaching & Service: Remote Mathematics Tutor at the WHIT Program (Aug 2025 -- Present), tutoring foster care youth in math through targeted remediation strategies. Intensive Care Unit (ICU) Hospital Volunteer (Aug 2025 -- Present) supporting patient care and clinical operations.'
    },
    {
      title: 'Awards, Scholarships & Honors',
      text: 'Awards & Scholarships: Brown Foundation Scholar (Top 0.5%), National Merit Scholar, President\'s Endowed Scholar, Elkin Scholarship in CSCE (TAMU Department of Computer Science & Engineering), James W & Lee Roach Endowed Scholarship (TAMU College of Engineering), Southerland Aggie Leader Scholarship.'
    },
    {
      title: 'Technical Stack, Frameworks & Languages',
      text: 'Languages: Python, C/C++, Java, JavaScript, TypeScript, SQL, Bash, YAML, HTML/CSS, R. Frameworks: PyTorch, PyTorch Geometric, PyTorch Lightning, TensorFlow, scikit-learn, XGBoost, FastAPI, Next.js, Streamlit, Flask, Node.js. Tools & Infra: Linux, Docker, Podman, Ansible, Splunk, AWS GovCloud, Git, GitHub Actions, SLURM HPC, PostgreSQL, MySQL, MongoDB. Spoken Languages: English (Native), Bengali (Native), Spanish (Working), Hindi (Working).'
    },
    {
      title: 'Certifications — Cybersecurity & Infrastructure',
      text: `Key Cybersecurity Certifications: ${certs.cybersecurity.slice(0, 25).join('; ')}.`
    },
    {
      title: 'Certifications — Cloud, AI & Machine Learning',
      text: `Key Cloud & AI Certifications: ${certs.cloud_ai.slice(0, 25).join('; ')}.`
    },
    {
      title: 'Certifications — Defense, Systems & Agile Management',
      text: `Defense & Management Certifications: ${certs.defense_industry.join('; ')}.`
    },
    {
      title: 'Certifications — Software Development & Engineering',
      text: `Software Development Certifications: ${certs.dev_software.slice(0, 25).join('; ')}.`
    },
    {
      title: 'Portfolio Website Architecture & Terminal Capabilities',
      text: 'dvxb.io is Devkumar\'s terminal-themed portfolio built with xterm.js, Three.js particles, CRT scanlines, Anime.js, Motion animations, NumberFlow counters, live GitHub Heatmap/Radar, and real-time in-browser RAG using BAAI/bge-small-en-v1.5 embeddings and Groq Cloud LPUs. Interactive terminal commands include help, ls, cat, ai, matrix, snake, quake, theme, clear, and stats.'
    }
  ];

  return chunks;
}

async function generateEmbeddings() {
  console.log('Loading @huggingface/transformers...');
  const { pipeline } = await import('@huggingface/transformers');
  
  console.log('Loading embedder model (Xenova/bge-small-en-v1.5)...');
  const embedder = await pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5', { dtype: 'fp32' });

  const chunks = buildChunks();
  console.log(`Generating embeddings for ${chunks.length} chunks...`);

  const output = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`[${i + 1}/${chunks.length}] Embedding: "${chunk.title}"`);
    const input = `${chunk.title}: ${chunk.text}`;
    const res = await embedder(input, { pooling: 'mean', normalize: true });
    const vector = Array.from(res.data);
    output.push({
      id: i,
      title: chunk.title,
      text: chunk.text,
      vector
    });
  }

  const outPath = resolve(SITE, 'assets', 'context-embeddings.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Successfully written ${output.length} chunks to ${outPath}`);
}

generateEmbeddings().catch(err => {
  console.error('Embedding generation failed:', err);
  process.exit(1);
});
