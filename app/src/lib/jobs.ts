import type { JobListing } from './types';
import { store } from './store.svelte';

export async function fetchJobFeed(): Promise<JobListing[]> {
  const base = store.settings.workerUrl;
  const res = await fetch(`${base}/jobs-rss`);
  if (!res.ok) throw new Error(`Job feed error: ${res.status}`);
  const data = await res.json() as JobListing[];
  return data;
}

export const PIPELINE_STAGES = [
  { id: 'radar',        label: 'Radar',        color: 'mu',  desc: 'Spotted, watching' },
  { id: 'queued',       label: 'Queued',        color: 'pu',  desc: 'Preparing to apply' },
  { id: 'applied',      label: 'Applied',       color: 'ac',  desc: 'Application submitted' },
  { id: 'screening',    label: 'Screening',     color: 'yw',  desc: 'Initial contact made' },
  { id: 'interviewing', label: 'Interviewing',  color: 'oj',  desc: 'Active interview rounds' },
  { id: 'offer',        label: 'Offer',         color: 'gn',  desc: 'Offer received' },
  { id: 'closed',       label: 'Closed',        color: 'mu',  desc: 'Passed / Withdrawn' },
] as const;

export const REGION_LABELS: Record<string, string> = {
  eu: 'Europe',
  india: 'India',
  uk: 'UK',
  remote: 'Remote',
  us: 'USA',
  other: 'Other',
};

export const TYPE_LABELS: Record<string, string> = {
  industry: 'Industry',
  academic: 'Academic',
  fellowship: 'Fellowship',
  startup: 'Startup',
  contract: 'Contract',
};

// Curated company directory — EU pharma/biotech + India pharma (>50cr)
export const EU_COMPANIES = [
  // Germany — nearest to Heidelberg
  { name: 'Merck KGaA', location: 'Darmstadt, Germany', country: 'DE', focus: ['oncology', 'immuno-oncology', 'biologics', 'Bavencio'], url: 'https://www.merckgroup.com/en/careers.html', tier: 'large' },
  { name: 'Boehringer Ingelheim', location: 'Ingelheim, Germany', country: 'DE', focus: ['oncology', 'immunology', 'ADCs', 'KRAS'], url: 'https://www.boehringer-ingelheim.com/en/careers', tier: 'large' },
  { name: 'BioNTech', location: 'Mainz, Germany', country: 'DE', focus: ['mRNA oncology', 'personalised cancer vaccines', 'immuno-oncology'], url: 'https://careers.biontech.de', tier: 'large' },
  { name: 'Heidelberg Pharma', location: 'Ladenburg, Germany', country: 'DE', focus: ['antibody-drug conjugates', 'ATAC platform', 'amatoxin-based ADCs'], url: 'https://www.heidelberg-pharma.com/career', tier: 'mid' },
  { name: 'CureVac', location: 'Tübingen, Germany', country: 'DE', focus: ['mRNA therapeutics', 'oncology', 'infectious disease'], url: 'https://www.curevac.com/en/careers', tier: 'mid' },
  { name: 'Bayer', location: 'Leverkusen, Germany', country: 'DE', focus: ['oncology', 'radiology', 'cell & gene therapy', 'Nubeqa'], url: 'https://www.bayer.com/en/careers', tier: 'large' },
  // Research/Academic Germany
  { name: 'EMBL', location: 'Heidelberg, Germany', country: 'DE', focus: ['genomics', 'structural biology', 'bioinformatics', 'single-cell', 'spatial'], url: 'https://www.embl.org/careers', tier: 'research' },
  { name: 'DKFZ', location: 'Heidelberg, Germany', country: 'DE', focus: ['cancer research', 'translational oncology', 'tumour immunology', 'epigenomics'], url: 'https://www.dkfz.de/en/stellenangebote/', tier: 'research' },
  { name: 'NCT Heidelberg', location: 'Heidelberg, Germany', country: 'DE', focus: ['translational oncology', 'gynaecological oncology', 'PARP inhibitor trials'], url: 'https://www.nct-heidelberg.de/en/about-us/careers.html', tier: 'research' },
  { name: 'Max Planck Society', location: 'Multiple, Germany', country: 'DE', focus: ['basic research', 'bioinformatics', 'computational biology'], url: 'https://www.mpg.de/en/careers', tier: 'research' },
  // Switzerland
  { name: 'Roche', location: 'Basel, Switzerland', country: 'CH', focus: ['oncology', 'diagnostics', 'personalised medicine', 'bevacizumab', 'atezolizumab'], url: 'https://www.roche.com/careers', tier: 'large' },
  { name: 'Novartis', location: 'Basel, Switzerland', country: 'CH', focus: ['oncology', 'radioligand therapy', 'CAR-T', 'Kisqali', 'Kymriah'], url: 'https://www.novartis.com/careers', tier: 'large' },
  { name: 'Ferring', location: 'Saint-Prex, Switzerland', country: 'CH', focus: ['reproductive medicine', 'gynaecology', 'bladder cancer'], url: 'https://www.ferring.com/careers', tier: 'mid' },
  // UK
  { name: 'AstraZeneca', location: 'Cambridge, UK', country: 'UK', focus: ['ovarian cancer', 'PARP inhibitors', 'olaparib (Lynparza)', 'ADCs', 'Imfinzi'], url: 'https://careers.astrazeneca.com', tier: 'large' },
  { name: 'GSK', location: 'London, UK', country: 'UK', focus: ['oncology', 'immuno-oncology', 'dostarlimab', 'BRAF/MEK'], url: 'https://www.gsk.com/en-gb/careers', tier: 'large' },
  // France
  { name: 'Sanofi', location: 'Paris, France', country: 'FR', focus: ['oncology', 'immunology', 'biologics', 'isatuximab'], url: 'https://www.sanofi.com/en/careers', tier: 'large' },
  { name: 'Ipsen', location: 'Paris, France', country: 'FR', focus: ['oncology', 'rare diseases', 'neuroendocrine tumours'], url: 'https://www.ipsen.com/careers', tier: 'mid' },
  { name: 'Servier', location: 'Suresnes, France', country: 'FR', focus: ['oncology', 'haematology', 'vorasidenib'], url: 'https://www.servier.com/en/careers', tier: 'mid' },
  // Belgium
  { name: 'UCB', location: 'Brussels, Belgium', country: 'BE', focus: ['immunology', 'neurology', 'biologics'], url: 'https://www.ucb.com/careers', tier: 'mid' },
  { name: 'Janssen (J&J)', location: 'Beerse, Belgium', country: 'BE', focus: ['oncology', 'haematology', 'BRCA', 'niraparib (Zejula)', 'daratumumab'], url: 'https://jobs.jnj.com', tier: 'large' },
  // Denmark
  { name: 'Genmab', location: 'Copenhagen, Denmark', country: 'DK', focus: ['antibody engineering', 'oncology ADCs', 'DuoBody platform', 'epcoritamab'], url: 'https://www.genmab.com/careers', tier: 'large' },
  { name: 'Novo Nordisk', location: 'Bagsværd, Denmark', country: 'DK', focus: ['diabetes', 'obesity', 'oncology pipeline', 'GLP-1 + cancer'], url: 'https://www.novonordisk.com/careers.html', tier: 'large' },
  // Netherlands
  { name: 'Merus', location: 'Utrecht, Netherlands', country: 'NL', focus: ['bispecific antibodies', 'oncology', 'Zenocutuzumab'], url: 'https://www.merus.nl/careers', tier: 'mid' },
  // Ireland/US EU hubs
  { name: 'Pfizer', location: 'Dublin, Ireland (EU hub)', country: 'IE', focus: ['oncology', 'palbociclib (Ibrance)', 'talazoparib', 'immunology'], url: 'https://careers.pfizer.com', tier: 'large' },
] as const;

export const INDIA_COMPANIES = [
  { name: 'Biocon', location: 'Bengaluru, India', focus: ['oncology biosimilars', 'trastuzumab', 'bevacizumab', 'novel biologics', 'BRAC platform'], url: 'https://biocon.com/careers', tier: 'large' },
  { name: 'Syngene International', location: 'Bengaluru, India', focus: ['CRO/CDMO', 'discovery biology', 'genomics services', 'cancer biology'], url: 'https://www.syngeneintl.com/careers', tier: 'mid' },
  { name: "Dr. Reddy's Laboratories", location: 'Hyderabad, India', focus: ['generics', 'biologics', 'oncology generics', 'novel APIs'], url: 'https://www.drreddys.com/careers', tier: 'large' },
  { name: 'Sun Pharmaceutical', location: 'Mumbai, India', focus: ['specialty oncology', 'targeted therapy', 'dermatology'], url: 'https://careers.sunpharma.com', tier: 'large' },
  { name: 'Cipla', location: 'Mumbai, India', focus: ['generic oncology', 'biologics', 'inhaled therapies'], url: 'https://careers.cipla.com', tier: 'large' },
  { name: 'Natco Pharma', location: 'Hyderabad, India', focus: ['oncology generics', 'sorafenib', 'imatinib', 'PARP inhibitor generics'], url: 'https://natcoindia.com/career', tier: 'mid' },
  { name: 'Lupin', location: 'Mumbai, India', focus: ['generics', 'oncology', 'complex injectables'], url: 'https://lupin.com/careers', tier: 'large' },
  { name: 'Aurobindo Pharma', location: 'Hyderabad, India', focus: ['APIs', 'oncology generics', 'injectables'], url: 'https://www.aurobindo.com/careers', tier: 'large' },
  { name: 'Piramal Pharma', location: 'Mumbai, India', focus: ['CDMO', 'oncology APIs', 'contract research', 'nuclear medicine'], url: 'https://www.piramalpharma.com/careers', tier: 'mid' },
  { name: 'Aragen Life Sciences', location: 'Hyderabad, India', focus: ['CRO/CDMO', 'oncology research', 'genomics', 'translational science'], url: 'https://www.aragen.com/careers', tier: 'mid' },
  { name: 'Glenmark', location: 'Mumbai, India', focus: ['immuno-oncology', 'ISB 2001', 'novel biologics', 'dermatology'], url: 'https://www.glenmarkpharma.com/careers', tier: 'mid' },
  { name: 'Jubilant Pharmova', location: 'Noida, India', focus: ['radiopharmaceuticals', 'oncology', 'Lutetium-177'], url: 'https://jubilantpharmova.com/careers', tier: 'mid' },
  { name: 'Zydus Lifesciences', location: 'Ahmedabad, India', focus: ['novel biologics', 'oncology', 'mRNA platform'], url: 'https://zyduslife.com/career', tier: 'large' },
  { name: 'Intas Pharmaceuticals', location: 'Ahmedabad, India', focus: ['oncology biosimilars', 'rituximab biosimilar', 'injectables'], url: 'https://www.intaspharma.com/careers', tier: 'mid' },
  { name: 'Alkem Laboratories', location: 'Mumbai, India', focus: ['generic oncology', 'injectables', 'nutraceuticals'], url: 'https://www.alkemlabs.com/careers', tier: 'mid' },
  // Research India
  { name: 'NCBS (TIFR)', location: 'Bengaluru, India', focus: ['cell biology', 'cancer genomics', 'scRNA-seq', 'signalling'], url: 'https://www.ncbs.res.in/jobs', tier: 'research' },
  { name: 'InStem', location: 'Bengaluru, India', focus: ['stem cells', 'cancer biology', 'spatial genomics'], url: 'https://www.instem.res.in/careers', tier: 'research' },
  { name: 'CCMB (CSIR)', location: 'Hyderabad, India', focus: ['genomics', 'cancer genomics', 'proteomics', 'structural biology'], url: 'https://www.ccmb.res.in/employment', tier: 'research' },
  { name: 'Tata Memorial Centre', location: 'Mumbai, India', focus: ['clinical oncology', 'translational cancer research', 'gynaecological oncology'], url: 'https://tmc.gov.in/index.php/faculty-positions', tier: 'research' },
  { name: 'ACTREC', location: 'Navi Mumbai, India', focus: ['cancer research', 'translational biology', 'molecular diagnostics'], url: 'https://actrec.gov.in/careers', tier: 'research' },
  { name: 'RCB (Regional Centre for Biotechnology)', location: 'Faridabad, India', focus: ['bioinformatics', 'structural biology', 'cancer biology', 'proteomics'], url: 'https://www.rcb.res.in/career', tier: 'research' },
  { name: 'NII (National Immunology Institute)', location: 'New Delhi, India', focus: ['immunology', 'cancer immunology', 'T cell biology'], url: 'https://www.nii.res.in/en/job-vacancies', tier: 'research' },
] as const;
