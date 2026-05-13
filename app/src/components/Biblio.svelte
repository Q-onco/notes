<script lang="ts">
  import { store } from '../lib/store.svelte';
  import { nanoid } from 'nanoid';
  import type { BiblioReference, BiblioCollection, BiblioAuthor, BiblioRefType, BiblioReadStatus } from '../lib/types';

  // ── Types ────────────────────────────────────────────────────────────────
  type CiteStyle = 'vancouver' | 'apa' | 'nature' | 'chicago';
  type ImportMode = 'doi' | 'pmid' | 'arxiv' | 'bibtex' | 'manual';

  interface CuratedPaper {
    title: string;
    authors: string;
    year: number;
    journal: string;
    doi: string;
    abstract: string;
    category: string;
    pmid?: string;
  }

  // ── Static curated library ───────────────────────────────────────────────
  const CURATED: CuratedPaper[] = [
    // Cancer Immunology
    { title: 'Pembrolizumab versus chemotherapy for PD-L1-positive non-small-cell lung cancer', authors: 'Reck M et al.', year: 2016, journal: 'N Engl J Med', doi: '10.1056/NEJMoa1606774', abstract: 'First-line pembrolizumab significantly improved progression-free and overall survival vs chemotherapy in NSCLC with PD-L1 TPS ≥50%.', category: 'Cancer Immunology' },
    { title: 'Nivolumab versus docetaxel in advanced nonsquamous non-small-cell lung cancer', authors: 'Borghaei H et al.', year: 2015, journal: 'N Engl J Med', doi: '10.1056/NEJMoa1507643', abstract: 'Nivolumab showed improved overall survival and durable responses versus docetaxel in previously treated advanced non-squamous NSCLC.', category: 'Cancer Immunology' },
    { title: 'Safety and activity of anti-PD-L1 antibody in patients with advanced cancer', authors: 'Brahmer JR et al.', year: 2012, journal: 'N Engl J Med', doi: '10.1056/NEJMoa1200694', abstract: 'Anti-PD-L1 antibody showed clinical activity in advanced solid tumors with manageable safety profile.', category: 'Cancer Immunology' },
    { title: 'PD-1 blockade induces responses by inhibiting adaptive immune resistance', authors: 'Tumeh PC et al.', year: 2014, journal: 'Nature', doi: '10.1038/nature13954', abstract: 'Pre-existing CD8+ T cells at the invasive tumor margin predicted response to PD-1 blockade in melanoma.', category: 'Cancer Immunology' },
    { title: 'CAR T cells: from bench to bedside', authors: 'June CH, O\'Connor RS et al.', year: 2018, journal: 'Science', doi: '10.1126/science.aar6711', abstract: 'Comprehensive review of chimeric antigen receptor T-cell therapy development from laboratory to clinical application.', category: 'Cancer Immunology' },
    { title: 'Tumor mutational burden and response to immune checkpoint blockade', authors: 'Yarchoan M et al.', year: 2017, journal: 'N Engl J Med', doi: '10.1056/NEJMc1713444', abstract: 'Higher tumor mutational burden correlates with improved response rates to PD-1/PD-L1 blockade across tumor types.', category: 'Cancer Immunology' },
    { title: 'Resistance mechanisms to immune checkpoint inhibitors', authors: 'Sharma P et al.', year: 2017, journal: 'Cell', doi: '10.1016/j.cell.2017.01.017', abstract: 'Review of primary and acquired resistance mechanisms to immune checkpoint blockade and strategies to overcome them.', category: 'Cancer Immunology' },
    { title: 'Neoantigens in cancer immunotherapy', authors: 'Schumacher TN, Schreiber RD', year: 2015, journal: 'Science', doi: '10.1126/science.aaa4971', abstract: 'Tumor-specific neoantigens from somatic mutations are key targets for effective anti-tumor immune responses.', category: 'Cancer Immunology' },

    // scRNA-seq Methods
    { title: 'Massively parallel single-cell RNA-seq profiling of individual T cells', authors: 'Zheng GX et al.', year: 2017, journal: 'Nat Commun', doi: '10.1038/ncomms14049', abstract: '10x Chromium platform enables massively parallel scRNA-seq of thousands of cells with high sensitivity and low doublet rates.', category: 'scRNA-seq Methods' },
    { title: 'Comprehensive integration of single-cell data', authors: 'Stuart T et al.', year: 2019, journal: 'Cell', doi: '10.1016/j.cell.2019.05.031', abstract: 'Seurat v3 introduces anchor-based integration for single-cell datasets across technologies, species, and modalities.', category: 'scRNA-seq Methods' },
    { title: 'UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction', authors: 'McInnes L et al.', year: 2018, journal: 'arXiv', doi: '10.48550/arXiv.1802.03426', abstract: 'UMAP provides faster dimensionality reduction than t-SNE while better preserving global structure.', category: 'scRNA-seq Methods' },
    { title: 'Reversed graph embedding resolves complex single-cell trajectories', authors: 'Qiu X et al.', year: 2017, journal: 'Nat Methods', doi: '10.1038/nmeth.4402', abstract: 'Monocle 2 uses reversed graph embedding for accurate pseudotime analysis of complex developmental trajectories.', category: 'scRNA-seq Methods' },
    { title: 'DoubletFinder: doublet detection in single-cell RNA sequencing data', authors: 'McGinnis CS et al.', year: 2019, journal: 'Cell Syst', doi: '10.1016/j.cels.2019.03.003', abstract: 'DoubletFinder uses simulated doublets to identify real doublets in scRNA-seq data without a priori knowledge.', category: 'scRNA-seq Methods' },
    { title: 'Highly parallel genome-wide expression profiling of individual cells using nanoliter droplets', authors: 'Macosko EZ et al.', year: 2015, journal: 'Cell', doi: '10.1016/j.cell.2015.05.002', abstract: 'Drop-seq enables massively parallel single-cell transcriptomics at low cost using droplet microfluidics.', category: 'scRNA-seq Methods' },
    { title: 'Bayesian approach to single-cell differential expression analysis', authors: 'Kharchenko PV et al.', year: 2014, journal: 'Nat Methods', doi: '10.1038/nmeth.2967', abstract: 'SCDE models transcript capture efficiency using mixture models to improve differential expression in scRNA-seq.', category: 'scRNA-seq Methods' },
    { title: 'scVI: deep generative modeling for single-cell omics', authors: 'Lopez R et al.', year: 2018, journal: 'Nat Methods', doi: '10.1038/s41592-018-0229-2', abstract: 'scVI uses variational autoencoders to model scRNA-seq data accounting for batch effects and zero inflation.', category: 'scRNA-seq Methods' },

    // CRISPR / Functional Genomics
    { title: 'Multiplex genome engineering using CRISPR/Cas systems', authors: 'Cong L et al.', year: 2013, journal: 'Science', doi: '10.1126/science.1231143', abstract: 'Demonstration of CRISPR-Cas9-mediated multiplex genome editing in mammalian cells.', category: 'CRISPR / Functional Genomics' },
    { title: 'Genome-scale CRISPR-Cas9 knockout screening in human cells', authors: 'Shalem O et al.', year: 2014, journal: 'Science', doi: '10.1126/science.1247005', abstract: 'Genome-wide CRISPR pooled screens identify essential genes and drug resistance mechanisms in human cancer cells.', category: 'CRISPR / Functional Genomics' },
    { title: 'In vivo interrogation of gene function in the mammalian brain using CRISPR-Cas9', authors: 'Platt RJ et al.', year: 2014, journal: 'Cell', doi: '10.1016/j.cell.2014.09.014', abstract: 'Conditional CRISPR-Cas9 knockin mouse enables somatic genome editing and in vivo functional genomics.', category: 'CRISPR / Functional Genomics' },
    { title: 'Base editing: precision chemistry on the genome and transcriptome of living cells', authors: 'Rees HA, Liu DR', year: 2018, journal: 'Nat Rev Genet', doi: '10.1038/s41576-018-0059-1', abstract: 'Base editors enable precise single-nucleotide changes without double-strand breaks or donor templates.', category: 'CRISPR / Functional Genomics' },
    { title: 'High-fidelity CRISPR-Cas9 nucleases with no detectable genome-wide off-target effects', authors: 'Kleinstiver BP et al.', year: 2016, journal: 'Nature', doi: '10.1038/nature16526', abstract: 'Structure-guided engineering of SpCas9 variants with reduced off-target activity.', category: 'CRISPR / Functional Genomics' },
    { title: 'Optical control of mammalian endogenous transcription and epigenetic states', authors: 'Nihongaki Y et al.', year: 2015, journal: 'Nat Chem Biol', doi: '10.1038/nchembio.1853', abstract: 'Light-inducible CRISPR system enables precise spatiotemporal control of gene activation.', category: 'CRISPR / Functional Genomics' },
    { title: 'CRISPRi and CRISPRa for functional genomics', authors: 'Kampmann M', year: 2018, journal: 'ACS Chem Biol', doi: '10.1021/acschembio.7b01014', abstract: 'Review of CRISPR interference and activation approaches for systematic functional genomics in human cells.', category: 'CRISPR / Functional Genomics' },

    // Bioinformatics & Computational
    { title: 'STAR: ultrafast universal RNA-seq aligner', authors: 'Dobin A et al.', year: 2013, journal: 'Bioinformatics', doi: '10.1093/bioinformatics/bts635', abstract: 'STAR aligner enables fast and accurate alignment of RNA-seq reads to reference genomes.', category: 'Bioinformatics & Computational' },
    { title: 'DESeq2: moderated estimation of fold change and dispersion for RNA-seq data', authors: 'Love MI et al.', year: 2014, journal: 'Genome Biol', doi: '10.1186/s13059-014-0550-8', abstract: 'DESeq2 uses shrinkage estimators for fold changes and dispersions to improve differential expression analysis.', category: 'Bioinformatics & Computational' },
    { title: 'edgeR: a Bioconductor package for differential expression analysis of digital gene expression data', authors: 'Robinson MD et al.', year: 2010, journal: 'Bioinformatics', doi: '10.1093/bioinformatics/btp616', abstract: 'edgeR uses negative binomial models and empirical Bayes estimation for RNA-seq differential expression.', category: 'Bioinformatics & Computational' },
    { title: 'GATK: a framework for variant discovery and genotyping', authors: 'McKenna A et al.', year: 2010, journal: 'Genome Res', doi: '10.1101/gr.107524.110', abstract: 'GATK provides best-practice workflows for variant calling in whole-genome and whole-exome sequencing data.', category: 'Bioinformatics & Computational' },
    { title: 'Genome-wide association study of 14,000 cases of seven common diseases', authors: 'Wellcome Trust Case Control Consortium', year: 2007, journal: 'Nature', doi: '10.1038/nature05911', abstract: 'Landmark GWAS identifying susceptibility loci for seven major diseases including type 1/2 diabetes and cancer.', category: 'Bioinformatics & Computational' },
    { title: 'GSEA: gene set enrichment analysis', authors: 'Subramanian A et al.', year: 2005, journal: 'Proc Natl Acad Sci USA', doi: '10.1073/pnas.0506580102', abstract: 'GSEA detects coordinated changes in gene expression within predefined biological gene sets.', category: 'Bioinformatics & Computational' },
    { title: 'fastp: an ultra-fast all-in-one FASTQ preprocessor', authors: 'Chen S et al.', year: 2018, journal: 'Bioinformatics', doi: '10.1093/bioinformatics/bty560', abstract: 'fastp provides quality control, adapter trimming, and filtering for FASTQ data at high speed.', category: 'Bioinformatics & Computational' },
    { title: 'Salmon: fast and bias-aware quantification of transcript expression', authors: 'Patro R et al.', year: 2017, journal: 'Nat Methods', doi: '10.1038/nmeth.4197', abstract: 'Salmon quasi-mapping enables accurate and fast transcript-level quantification from RNA-seq data.', category: 'Bioinformatics & Computational' },

    // Clinical Trial Design
    { title: 'RECIST 1.1: response evaluation criteria in solid tumors', authors: 'Eisenhauer EA et al.', year: 2009, journal: 'Eur J Cancer', doi: '10.1016/j.ejca.2008.10.026', abstract: 'Updated RECIST guidelines for objective tumor response assessment in solid tumor clinical trials.', category: 'Clinical Trial Design' },
    { title: 'Adaptive clinical trial designs', authors: 'Berry DA', year: 2006, journal: 'Nat Rev Drug Discov', doi: '10.1038/nrd2138', abstract: 'Adaptive designs allow pre-planned modifications to trials based on accruing data, improving efficiency.', category: 'Clinical Trial Design' },
    { title: 'Basket trials in oncology: challenges and future directions', authors: 'Hyman DM et al.', year: 2015, journal: 'J Clin Oncol', doi: '10.1200/JCO.2015.62.3437', abstract: 'Basket trials test a single targeted therapy across multiple tumor types sharing a molecular alteration.', category: 'Clinical Trial Design' },
    { title: 'CONSORT 2010 statement: updated guidelines for reporting parallel group randomised trials', authors: 'Schulz KF et al.', year: 2010, journal: 'BMJ', doi: '10.1136/bmj.c332', abstract: 'Updated CONSORT guidelines for transparent and complete reporting of randomised controlled trials.', category: 'Clinical Trial Design' },
    { title: 'Master protocols: designing efficient clinical trials in oncology', authors: 'Park JJH et al.', year: 2019, journal: 'Nat Rev Clin Oncol', doi: '10.1038/s41571-019-0253-7', abstract: 'Master protocols including basket, umbrella, and platform trials enable efficient evaluation of multiple therapies.', category: 'Clinical Trial Design' },
    { title: 'Phase I trials in oncology: statistical design and analysis', authors: 'Le Tourneau C et al.', year: 2009, journal: 'J Natl Cancer Inst', doi: '10.1093/jnci/djp271', abstract: 'Comparison of statistical designs for dose-escalation trials in oncology.', category: 'Clinical Trial Design' },

    // Precision Oncology
    { title: 'Cancer genome landscapes', authors: 'Vogelstein B et al.', year: 2013, journal: 'Science', doi: '10.1126/science.1235122', abstract: 'Comprehensive analysis of cancer genome mutations identifies key driver genes and actionable targets.', category: 'Precision Oncology' },
    { title: 'The cancer genome atlas: an immeasurable source of knowledge', authors: 'Tomczak K et al.', year: 2015, journal: 'Contemp Oncol', doi: '10.5114/wo.2014.47136', abstract: 'Review of TCGA contributions to understanding the molecular landscape of human cancer.', category: 'Precision Oncology' },
    { title: 'Genomic hallmarks and structural variation in metastasis', authors: 'Priestley P et al.', year: 2019, journal: 'Nature', doi: '10.1038/s41586-019-1689-y', abstract: 'Whole genome sequencing of metastatic solid tumors reveals high frequency of actionable alterations.', category: 'Precision Oncology' },
    { title: 'Patient-derived organoids in oncology drug screening', authors: 'Vlachogiannis G et al.', year: 2018, journal: 'Science', doi: '10.1126/science.aao2064', abstract: 'Gastrointestinal cancer organoids predict patient clinical response to approved therapies.', category: 'Precision Oncology' },
    { title: 'Circulating tumor DNA to monitor metastatic breast cancer', authors: 'Dawson SJ et al.', year: 2013, journal: 'N Engl J Med', doi: '10.1056/NEJMoa1213261', abstract: 'ctDNA outperforms CA15-3 and CTC counts for monitoring treatment response in metastatic breast cancer.', category: 'Precision Oncology' },
    { title: 'BRCA1 and BRCA2: different roles in a common pathway of genome protection', authors: 'Moynahan ME, Jasin M', year: 2010, journal: 'Nat Rev Mol Cell Biol', doi: '10.1038/nrm2859', abstract: 'Review of distinct molecular functions of BRCA1 and BRCA2 in homologous recombination DNA repair.', category: 'Precision Oncology' },
    { title: 'Olaparib for metastatic castration-resistant prostate cancer', authors: 'de Bono J et al.', year: 2020, journal: 'N Engl J Med', doi: '10.1056/NEJMoa1911440', abstract: 'Olaparib significantly improved radiographic progression-free survival in HRR-mutant metastatic CRPC.', category: 'Precision Oncology' },

    // Tumor Microenvironment
    { title: 'The immunosuppressive tumor microenvironment: a barrier to immunotherapy', authors: 'Binnewies M et al.', year: 2018, journal: 'Nat Med', doi: '10.1038/s41591-018-0106-6', abstract: 'Framework for understanding how the TME shapes anti-tumor immunity and response to immunotherapy.', category: 'Tumor Microenvironment' },
    { title: 'Single-cell transcriptomics of human and mouse lung cancers reveals conserved myeloid populations', authors: 'Zilionis R et al.', year: 2019, journal: 'Immunity', doi: '10.1016/j.immuni.2019.03.009', abstract: 'scRNA-seq reveals conserved myeloid populations in human and mouse lung tumors with immunosuppressive functions.', category: 'Tumor Microenvironment' },
    { title: 'Landscape of infiltrating T cells in liver cancer revealed by single-cell sequencing', authors: 'Zheng C et al.', year: 2017, journal: 'Cell', doi: '10.1016/j.cell.2017.05.035', abstract: 'Single-cell analysis reveals exhausted CD8 T cells and regulatory T cells dominate liver cancer infiltrates.', category: 'Tumor Microenvironment' },
    { title: 'Cancer-associated fibroblasts: formation, function, and functional heterogeneity', authors: 'Sahai E et al.', year: 2020, journal: 'Nat Rev Cancer', doi: '10.1038/s41568-019-0213-9', abstract: 'Comprehensive review of cancer-associated fibroblast origins, states, and functions in tumor progression.', category: 'Tumor Microenvironment' },
    { title: 'Macrophage polarization and tumor progression', authors: 'Mantovani A et al.', year: 2002, journal: 'Trends Immunol', doi: '10.1016/s1471-4906(02)02302-5', abstract: 'M1/M2 macrophage polarization framework and its role in regulating tumor immunity and progression.', category: 'Tumor Microenvironment' },
    { title: 'Hypoxia-inducible factors: mediators of cancer progression', authors: 'Keith B, Johnson RS, Simon MC', year: 2012, journal: 'Nat Rev Cancer', doi: '10.1038/nrc3221', abstract: 'HIF pathway drives tumor angiogenesis, metabolic reprogramming, and immune evasion in hypoxic tumors.', category: 'Tumor Microenvironment' },

    // Drug Resistance
    { title: 'Mechanisms of resistance to targeted therapies in cancer', authors: 'Holohan C et al.', year: 2013, journal: 'Nat Rev Cancer', doi: '10.1038/nrc3599', abstract: 'Systematic review of molecular mechanisms underlying intrinsic and acquired resistance to targeted cancer therapies.', category: 'Drug Resistance' },
    { title: 'PARP inhibitor resistance: understanding and overcoming treatment failure', authors: 'Dias MP et al.', year: 2021, journal: 'Nat Rev Cancer', doi: '10.1038/s41568-021-00342-8', abstract: 'Mechanisms of PARP inhibitor resistance and strategies for combinatorial or sequential approaches.', category: 'Drug Resistance' },
    { title: 'Platinum resistance in ovarian cancer: molecular mechanisms and clinical significance', authors: 'Stewart DJ', year: 2010, journal: 'Crit Rev Oncol Hematol', doi: '10.1016/j.critrevonc.2009.09.002', abstract: 'Comprehensive review of mechanisms underlying platinum resistance in ovarian cancer.', category: 'Drug Resistance' },
    { title: 'Epithelial-to-mesenchymal transition and drug resistance', authors: 'Shibue T, Weinberg RA', year: 2017, journal: 'Nat Rev Clin Oncol', doi: '10.1038/nrclinonc.2016.192', abstract: 'EMT confers mesenchymal properties and drug resistance, contributing to metastasis and treatment failure.', category: 'Drug Resistance' },
    { title: 'Clonal evolution and resistance to targeted therapies', authors: 'McGranahan N, Swanton C', year: 2017, journal: 'Cell', doi: '10.1016/j.cell.2017.01.017', abstract: 'Intratumor heterogeneity and clonal dynamics underlie both primary and acquired resistance.', category: 'Drug Resistance' },
    { title: 'ABC transporters and drug resistance in cancer', authors: 'Fletcher JI et al.', year: 2010, journal: 'Nat Rev Cancer', doi: '10.1038/nrc2789', abstract: 'ABC transporter-mediated multidrug resistance and strategies for overcoming efflux-based resistance.', category: 'Drug Resistance' },

    // Translational & Regulatory
    { title: 'Accelerating drug development: breakthrough therapy designation', authors: 'Kim C, Prasad V', year: 2015, journal: 'N Engl J Med', doi: '10.1056/NEJMp1508311', abstract: 'Analysis of FDA breakthrough therapy designation and its impact on drug development timelines.', category: 'Translational & Regulatory' },
    { title: 'Predictive biomarkers for checkpoint inhibitor response', authors: 'Topalian SL et al.', year: 2016, journal: 'Cancer Cell', doi: '10.1016/j.ccell.2016.09.001', abstract: 'Review of biomarkers predicting response to PD-1/PD-L1 pathway inhibitors.', category: 'Translational & Regulatory' },
    { title: 'FDA approval of companion diagnostics', authors: 'Gutierrez ME, Kummar S, Giaccone G', year: 2009, journal: 'Nat Rev Drug Discov', doi: '10.1038/nrd2880', abstract: 'Regulatory framework for companion diagnostics co-developed with targeted oncology therapeutics.', category: 'Translational & Regulatory' },
    { title: 'Tumor heterogeneity and the evolution of polyclonal drug resistance', authors: 'Gillies RJ et al.', year: 2012, journal: 'Mol Pharm', doi: '10.1021/mp200435e', abstract: 'Tumor heterogeneity drives emergence of drug-resistant clones, necessitating combination approaches.', category: 'Translational & Regulatory' },
    { title: 'Co-clinical trials: integrating mouse and human trials', authors: 'Chen Z et al.', year: 2012, journal: 'Sci Transl Med', doi: '10.1126/scitranslmed.3004560', abstract: 'Simultaneous mouse and human trials enable rapid biomarker identification and treatment optimization.', category: 'Translational & Regulatory' },

    // Epigenomics & Multi-omics
    { title: 'An integrated encyclopedia of DNA elements in the human genome (ENCODE)', authors: 'ENCODE Project Consortium', year: 2012, journal: 'Nature', doi: '10.1038/nature11247', abstract: 'ENCODE characterizes functional elements in the human genome including regulatory regions and transcription factor binding.', category: 'Epigenomics & Multi-omics' },
    { title: 'Chromatin accessibility landscape of the human genome', authors: 'Buenrostro JD et al.', year: 2013, journal: 'Nat Methods', doi: '10.1038/nmeth.2688', abstract: 'ATAC-seq provides rapid genome-wide profiling of chromatin accessibility from small cell numbers.', category: 'Epigenomics & Multi-omics' },
    { title: 'Multi-omics factor analysis: a framework for unsupervised integration of multi-omics data sets', authors: 'Argelaguet R et al.', year: 2018, journal: 'Mol Syst Biol', doi: '10.15252/msb.20178124', abstract: 'MOFA provides unsupervised factor analysis framework for integrating heterogeneous multi-omics datasets.', category: 'Epigenomics & Multi-omics' },
    { title: 'DNA methylation in cancer: epigenetic alterations and consequences', authors: 'Esteller M', year: 2008, journal: 'N Engl J Med', doi: '10.1056/NEJMra072067', abstract: 'Comprehensive review of aberrant DNA methylation patterns in cancer and their therapeutic implications.', category: 'Epigenomics & Multi-omics' },
    { title: 'ChIP-seq: advantages and challenges of a maturing technology', authors: 'Landt SG et al.', year: 2012, journal: 'Genome Res', doi: '10.1101/gr.136184.111', abstract: 'Best practices for ChIP-seq experimental design and analysis.', category: 'Epigenomics & Multi-omics' },
    { title: 'Spatial transcriptomics at subspot resolution with BayesSpace', authors: 'Zhao E et al.', year: 2021, journal: 'Nat Biotechnol', doi: '10.1038/s41587-021-00935-2', abstract: 'BayesSpace enables subspot resolution analysis of spatial transcriptomics data using Bayesian statistics.', category: 'Epigenomics & Multi-omics' },
    { title: 'Single-cell multiome ATAC + gene expression analysis', authors: 'Ma S et al.', year: 2020, journal: 'Cell', doi: '10.1016/j.cell.2020.09.024', abstract: 'Joint profiling of chromatin accessibility and gene expression in single cells reveals gene regulatory logic.', category: 'Epigenomics & Multi-omics' },
    { title: 'Histone modifications as an intersection between diet and longevity', authors: 'Benayoun BA et al.', year: 2015, journal: 'Front Genet', doi: '10.3389/fgene.2015.00245', abstract: 'Review of histone modification dynamics and their roles in aging and age-related diseases including cancer.', category: 'Epigenomics & Multi-omics' },
  ];

  const CATEGORIES = [...new Set(CURATED.map(p => p.category))];

  // ── State ────────────────────────────────────────────────────────────────
  let activeTab = $state<'library' | 'curated'>('library');

  // Import modal
  let showImport = $state(false);
  let importMode = $state<ImportMode>('doi');
  let importQuery = $state('');
  let importLoading = $state(false);
  let importError = $state('');
  let importPreview = $state<Partial<BiblioReference> | null>(null);

  // Manual form
  let manualForm = $state<Partial<BiblioReference>>({
    type: 'article', title: '', authors: [{ given: '', family: '' }],
    year: null, journal: '', volume: '', issue: '', pages: '', doi: '',
    pmid: '', url: '', abstract: '', tags: [], collectionIds: [], notes: ''
  });
  let bibtexRaw = $state('');
  const bibtexPlaceholder = '@article{key, author={Smith, John}, title={...}, year={2024}}';

  // Selection / detail
  let selectedId = $state<string | null>(null);
  let editingRef = $state<BiblioReference | null>(null);
  let showDetail = $state(false);

  // Filters + sort
  let search = $state('');
  let typeFilter = $state('');
  let statusFilter = $state('');
  let collectionFilter = $state('');
  let tagFilter = $state('');
  let yearFrom = $state('');
  let yearTo = $state('');
  let sortBy = $state<'added' | 'year-desc' | 'year-asc' | 'author' | 'title' | 'rating'>('added');

  // OpenAlex fetch
  let citeFetchingId = $state<string | null>(null);

  // Multi-select for batch ops
  let selectedIds = $state<Set<string>>(new Set());
  let selectMode = $state(false);

  // Citation
  let citeStyle = $state<CiteStyle>('vancouver');

  // Curated
  let curatedCategory = $state('');
  let curatedSearch = $state('');

  // Collections
  let showCollForm = $state(false);
  let newCollName = $state('');
  let newCollColor = $state('#6366f1');
  let newCollParent = $state('');
  let sidebarCollapsed = $state(false);

  // Toast
  let toastMsg = $state('');
  let toastTimer: ReturnType<typeof setTimeout>;

  // Tag input
  let tagInput = $state('');

  function showToast(msg: string) {
    toastMsg = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastMsg = ''; }, 3000);
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  let filteredRefs = $derived.by(() => {
    let refs = store.biblioRefs;
    if (search) {
      const q = search.toLowerCase();
      refs = refs.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.authors.some(a => `${a.given} ${a.family}`.toLowerCase().includes(q)) ||
        r.journal.toLowerCase().includes(q) ||
        r.doi.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (typeFilter) refs = refs.filter(r => r.type === typeFilter);
    if (statusFilter) refs = refs.filter(r => r.readStatus === statusFilter);
    if (tagFilter) refs = refs.filter(r => r.tags.includes(tagFilter));
    if (collectionFilter === '__uncollected') {
      refs = refs.filter(r => r.collectionIds.length === 0);
    } else if (collectionFilter) {
      refs = refs.filter(r => r.collectionIds.includes(collectionFilter));
    }
    if (yearFrom) refs = refs.filter(r => r.year !== null && r.year >= parseInt(yearFrom));
    if (yearTo) refs = refs.filter(r => r.year !== null && r.year <= parseInt(yearTo));
    return [...refs].sort((a, b) => {
      if (sortBy === 'year-desc') return (b.year ?? 0) - (a.year ?? 0);
      if (sortBy === 'year-asc') return (a.year ?? 0) - (b.year ?? 0);
      if (sortBy === 'author') return (a.authors[0]?.family ?? '').localeCompare(b.authors[0]?.family ?? '');
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'rating') return b.rating - a.rating;
      return b.addedAt - a.addedAt;
    });
  });

  let allTags = $derived.by(() => {
    const s = new Set<string>();
    store.biblioRefs.forEach(r => r.tags.forEach(t => s.add(t)));
    return [...s].sort();
  });

  let filteredCurated = $derived.by(() => {
    let items = CURATED;
    if (curatedCategory) items = items.filter(p => p.category === curatedCategory);
    if (curatedSearch) {
      const q = curatedSearch.toLowerCase();
      items = items.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.journal.toLowerCase().includes(q)
      );
    }
    return items;
  });

  let addedDois = $derived(new Set(store.biblioRefs.map(r => r.doi).filter(Boolean)));

  let selectedRef = $derived(selectedId ? store.biblioRefs.find(r => r.id === selectedId) ?? null : null);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function makeRef(partial: Partial<BiblioReference>): BiblioReference {
    const now = Date.now();
    return {
      id: nanoid(), type: 'article', title: '', authors: [], year: null,
      journal: '', volume: '', issue: '', pages: '', doi: '', pmid: '', pmcid: '',
      arxivId: '', url: '', pdfUrl: '', abstract: '', keywords: [], language: '',
      publisher: '', edition: '', collectionIds: [], tags: [], rating: 0,
      readStatus: 'unread', citeKey: '', notes: '', citationCount: null, annotations: [],
      addedAt: now, updatedAt: now, source: 'manual',
      ...partial
    };
  }

  function authorStr(authors: BiblioAuthor[], max = 3): string {
    if (!authors.length) return '';
    const parts = authors.map(a => a.family ? `${a.family} ${a.given.slice(0,1)}` : a.given).filter(Boolean);
    if (parts.length <= max) return parts.join(', ');
    return parts.slice(0, max).join(', ') + ` et al.`;
  }

  function generateCiteKey(ref: Partial<BiblioReference>): string {
    const family = ref.authors?.[0]?.family ?? 'Unknown';
    const year = ref.year ?? 0;
    const base = `${family}${year}`;
    const existing = store.biblioRefs.filter(r => r.citeKey.startsWith(base) && r.id !== ref.id);
    if (!existing.length) return base;
    const suffixes = 'abcdefghijklmnopqrstuvwxyz';
    return `${base}${suffixes[existing.length - 1] ?? existing.length}`;
  }

  function detectDuplicate(ref: Partial<BiblioReference>): BiblioReference | null {
    if (ref.doi) {
      const found = store.biblioRefs.find(r => r.doi === ref.doi);
      if (found) return found;
    }
    if (ref.pmid) {
      const found = store.biblioRefs.find(r => r.pmid === ref.pmid);
      if (found) return found;
    }
    if (ref.title && ref.year) {
      const titleLow = ref.title.toLowerCase();
      const found = store.biblioRefs.find(r =>
        r.year === ref.year && r.title.toLowerCase() === titleLow
      );
      if (found) return found;
    }
    return null;
  }

  // ── Import functions ──────────────────────────────────────────────────────
  function parseCrossRefAuthor(a: any): BiblioAuthor {
    return { given: a.given ?? '', family: a.family ?? a.name ?? '' };
  }

  async function fetchByDOI(doi: string): Promise<Partial<BiblioReference>> {
    doi = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (!res.ok) throw new Error('DOI not found in CrossRef');
    const { message: m } = await res.json();
    const authors: BiblioAuthor[] = (m.author ?? []).map(parseCrossRefAuthor);
    const year = m['published-print']?.['date-parts']?.[0]?.[0]
      ?? m['published-online']?.['date-parts']?.[0]?.[0]
      ?? m['issued']?.['date-parts']?.[0]?.[0] ?? null;
    const ref: Partial<BiblioReference> = {
      type: 'article', title: (m.title?.[0] ?? '').replace(/<[^>]+>/g, ''),
      authors, year, journal: m['container-title']?.[0] ?? '',
      volume: m.volume ?? '', issue: m.issue ?? '', pages: m.page ?? '',
      doi, publisher: m.publisher ?? '',
      abstract: (m.abstract ?? '').replace(/<[^>]+>/g, ''),
      url: m.URL ?? `https://doi.org/${doi}`,
      source: 'doi'
    };
    // Unpaywall OA check
    try {
      const uw = await fetch(`https://api.unpaywall.org/v2/${encodeURIComponent(doi)}?email=quant.onco@gmail.com`);
      if (uw.ok) {
        const ud = await uw.json();
        if (ud.best_oa_location?.url_for_pdf) ref.pdfUrl = ud.best_oa_location.url_for_pdf;
        else if (ud.best_oa_location?.url) ref.url = ud.best_oa_location.url;
      }
    } catch { /* unpaywall optional */ }
    return ref;
  }

  async function fetchByPMID(pmid: string): Promise<Partial<BiblioReference>> {
    pmid = pmid.trim();
    const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('PubMed request failed');
    const json = await res.json();
    const r = json.result?.[pmid];
    if (!r) throw new Error('PMID not found');
    const authors: BiblioAuthor[] = (r.authors ?? []).map((a: any) => {
      const parts = a.name.split(' ');
      return { family: parts[0] ?? '', given: parts.slice(1).join(' ') };
    });
    const rawYear = r.pubdate?.match(/(\d{4})/)?.[1];
    const year = rawYear ? parseInt(rawYear) : null;
    return {
      type: 'article', title: r.title ?? '', authors, year,
      journal: r.fulljournalname ?? r.source ?? '',
      volume: r.volume ?? '', issue: r.issue ?? '', pages: r.pages ?? '',
      doi: r.elocationid?.replace('doi: ', '') ?? '',
      pmid, url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      source: 'pmid'
    };
  }

  async function fetchByArxiv(id: string): Promise<Partial<BiblioReference>> {
    id = id.trim().replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '');
    const url = `https://export.arxiv.org/api/query?id_list=${id}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('arXiv request failed');
    const xml = await res.text();
    const dp = new DOMParser();
    const doc = dp.parseFromString(xml, 'application/xml');
    const entry = doc.querySelector('entry');
    if (!entry) throw new Error('arXiv ID not found');
    const title = entry.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ') ?? '';
    const abstract = entry.querySelector('summary')?.textContent?.trim() ?? '';
    const published = entry.querySelector('published')?.textContent?.trim() ?? '';
    const year = published ? parseInt(published.slice(0, 4)) : null;
    const authorEls = [...entry.querySelectorAll('author')];
    const authors: BiblioAuthor[] = authorEls.map(a => {
      const name = a.querySelector('name')?.textContent ?? '';
      const parts = name.split(' ');
      return { family: parts[parts.length - 1] ?? '', given: parts.slice(0, -1).join(' ') };
    });
    const link = [...entry.querySelectorAll('link')].find(l => l.getAttribute('title') === 'pdf');
    return {
      type: 'preprint', title, authors, year,
      journal: 'arXiv', arxivId: id,
      abstract, url: `https://arxiv.org/abs/${id}`,
      pdfUrl: link?.getAttribute('href') ?? `https://arxiv.org/pdf/${id}`,
      doi: `10.48550/arXiv.${id}`, source: 'arxiv'
    };
  }

  function parseBibTeX(raw: string): Partial<BiblioReference>[] {
    const entries: Partial<BiblioReference>[] = [];
    const entryRe = /@(\w+)\s*\{([^,]+),([^@]*)\}/gs;
    let m;
    while ((m = entryRe.exec(raw)) !== null) {
      const type = m[1].toLowerCase();
      const fields: Record<string, string> = {};
      const fieldRe = /(\w+)\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
      let fm;
      while ((fm = fieldRe.exec(m[3])) !== null) {
        fields[fm[1].toLowerCase()] = fm[2].trim();
      }
      const authorStr2 = fields.author ?? '';
      const authors: BiblioAuthor[] = authorStr2.split(/ and /i).map(s => {
        const parts = s.trim().split(',');
        if (parts.length >= 2) return { family: parts[0].trim(), given: parts[1].trim() };
        const ws = s.trim().split(' ');
        return { family: ws[ws.length - 1] ?? '', given: ws.slice(0, -1).join(' ') };
      }).filter(a => a.family || a.given);
      const year = fields.year ? parseInt(fields.year) : null;
      const refType: BiblioRefType = type === 'book' ? 'book'
        : type === 'phdthesis' || type === 'mastersthesis' ? 'thesis'
        : type === 'inproceedings' || type === 'proceedings' ? 'conference'
        : type === 'misc' && fields.howpublished?.includes('arxiv') ? 'preprint'
        : 'article';
      entries.push({
        type: refType, title: fields.title ?? '', authors, year,
        journal: fields.journal ?? fields.booktitle ?? '',
        volume: fields.volume ?? '', issue: fields.number ?? '',
        pages: fields.pages ?? '', doi: fields.doi ?? '',
        url: fields.url ?? '', abstract: fields.abstract ?? '',
        publisher: fields.publisher ?? '', source: 'bibtex'
      });
    }
    return entries;
  }

  function parseRIS(raw: string): Partial<BiblioReference>[] {
    const entries: Partial<BiblioReference>[] = [];
    const blocks = raw.split(/\nER\s*-/).map(b => b.trim()).filter(Boolean);
    for (const block of blocks) {
      const fields: Record<string, string[]> = {};
      for (const line of block.split('\n')) {
        const m = line.match(/^([A-Z][A-Z0-9])\s+-\s+(.*)/);
        if (!m) continue;
        const [, tag, val] = m;
        if (!fields[tag]) fields[tag] = [];
        fields[tag].push(val.trim());
      }
      const ty = fields['TY']?.[0] ?? 'JOUR';
      const refType: BiblioRefType = ty === 'BOOK' ? 'book' : ty === 'THES' ? 'thesis'
        : ty === 'CONF' ? 'conference' : ty === 'ELEC' ? 'preprint' : 'article';
      const authors: BiblioAuthor[] = (fields['AU'] ?? fields['A1'] ?? []).map(s => {
        const [fam, giv] = s.split(',');
        return { family: fam?.trim() ?? '', given: giv?.trim() ?? '' };
      });
      const year = parseInt(fields['PY']?.[0] ?? fields['Y1']?.[0] ?? '') || null;
      const sp = fields['SP']?.[0] ?? '';
      const ep = fields['EP']?.[0] ?? '';
      const pages = sp && ep ? `${sp}-${ep}` : sp || ep;
      entries.push({
        type: refType,
        title: fields['TI']?.[0] ?? fields['T1']?.[0] ?? '',
        authors, year,
        journal: fields['JO']?.[0] ?? fields['T2']?.[0] ?? fields['JF']?.[0] ?? '',
        volume: fields['VL']?.[0] ?? '',
        issue: fields['IS']?.[0] ?? '',
        pages,
        doi: fields['DO']?.[0] ?? '',
        url: fields['UR']?.[0] ?? '',
        abstract: fields['AB']?.[0] ?? fields['N2']?.[0] ?? '',
        source: 'bibtex'
      });
    }
    return entries;
  }

  async function fetchCitationCount(ref: BiblioReference) {
    if (!ref.doi) return;
    citeFetchingId = ref.id;
    try {
      const res = await fetch(`https://api.openalex.org/works/doi:${encodeURIComponent(ref.doi)}?select=cited_by_count`);
      if (!res.ok) throw new Error('Not found');
      const data = await res.json();
      const count = data.cited_by_count ?? null;
      store.biblioRefs = store.biblioRefs.map(r => r.id === ref.id
        ? { ...r, citationCount: count, updatedAt: Date.now() } : r);
      store.saveBiblio();
      showToast(count !== null ? `${count} citations (OpenAlex)` : 'Count unavailable');
    } catch { showToast('Could not fetch citation count'); }
    finally { citeFetchingId = null; }
  }

  function toggleCollectionOnRef(ref: BiblioReference, collId: string) {
    const has = ref.collectionIds.includes(collId);
    store.biblioRefs = store.biblioRefs.map(r => r.id === ref.id
      ? { ...r, collectionIds: has ? r.collectionIds.filter(c => c !== collId) : [...r.collectionIds, collId], updatedAt: Date.now() }
      : r);
    store.saveBiblio();
  }

  function toggleSelectRef(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    selectedIds = next;
  }

  function bulkDelete() {
    if (!selectedIds.size) return;
    store.biblioRefs = store.biblioRefs.filter(r => !selectedIds.has(r.id));
    store.saveBiblio();
    if (selectedId && selectedIds.has(selectedId)) { selectedId = null; showDetail = false; }
    selectedIds = new Set();
    selectMode = false;
    showToast('Deleted');
  }

  function bulkMoveToCollection(collId: string) {
    store.biblioRefs = store.biblioRefs.map(r =>
      selectedIds.has(r.id) && !r.collectionIds.includes(collId)
        ? { ...r, collectionIds: [...r.collectionIds, collId], updatedAt: Date.now() }
        : r
    );
    store.saveBiblio();
    selectedIds = new Set();
    selectMode = false;
    showToast('Moved to collection');
  }

  // ── Citation formatters ───────────────────────────────────────────────────
  function fmtAuthorsVancouver(authors: BiblioAuthor[], max = 6): string {
    const parts = authors.map(a => `${a.family} ${a.given.split(' ').map(i => i[0]).join('')}`);
    if (parts.length <= max) return parts.join(', ');
    return parts.slice(0, max).join(', ') + ', et al';
  }

  function formatVancouver(r: BiblioReference): string {
    const au = fmtAuthorsVancouver(r.authors);
    const yr = r.year ?? 'n.d.';
    const j = r.journal;
    const vol = r.volume ? `;${r.volume}` : '';
    const iss = r.issue ? `(${r.issue})` : '';
    const pg = r.pages ? `:${r.pages}` : '';
    const doi = r.doi ? `. doi:${r.doi}` : '';
    return `${au}. ${r.title}. ${j}. ${yr}${vol}${iss}${pg}${doi}`;
  }

  function fmtAuthorsAPA(authors: BiblioAuthor[]): string {
    const parts = authors.map(a => `${a.family}, ${a.given.split(' ').map(i => i[0] + '.').join(' ')}`);
    if (parts.length === 1) return parts[0];
    if (parts.length <= 7) return parts.slice(0, -1).join(', ') + ', & ' + parts[parts.length - 1];
    return parts.slice(0, 6).join(', ') + ', … ' + parts[parts.length - 1];
  }

  function formatAPA(r: BiblioReference): string {
    const au = fmtAuthorsAPA(r.authors);
    const yr = r.year ?? 'n.d.';
    const vol = r.volume ? `, ${r.volume}` : '';
    const iss = r.issue ? `(${r.issue})` : '';
    const pg = r.pages ? `, ${r.pages}` : '';
    const doi = r.doi ? ` https://doi.org/${r.doi}` : r.url ? ` ${r.url}` : '';
    return `${au} (${yr}). ${r.title}. *${r.journal}*${vol}${iss}${pg}.${doi}`;
  }

  function formatNature(r: BiblioReference): string {
    const au = r.authors.length > 5
      ? r.authors.slice(0, 5).map(a => `${a.given.split(' ').map(i => i[0] + '.').join('. ')} ${a.family}`).join(', ') + ' et al.'
      : r.authors.map(a => `${a.given.split(' ').map(i => i[0] + '.').join('. ')} ${a.family}`).join(', ');
    const yr = r.year ?? 'n.d.';
    const vol = r.volume ? ` ${r.volume},` : '';
    const pg = r.pages ? ` ${r.pages}` : '';
    const doi = r.doi ? ` (${yr}). https://doi.org/${r.doi}` : ` (${yr}).`;
    return `${au}. ${r.title}. *${r.journal}*${vol}${pg}${doi}`;
  }

  function formatChicago(r: BiblioReference): string {
    const first = r.authors[0];
    const firstFmt = first ? `${first.family}, ${first.given}` : '';
    const rest = r.authors.slice(1).map(a => `${a.given} ${a.family}`).join(', ');
    const au = rest ? `${firstFmt}, and ${rest}` : firstFmt;
    const yr = r.year ?? 'n.d.';
    const vol = r.volume ? ` ${r.volume},` : '';
    const iss = r.issue ? ` no. ${r.issue}` : '';
    const pg = r.pages ? `: ${r.pages}` : '';
    return `${au}. "${r.title}." *${r.journal}*${vol}${iss} (${yr})${pg}.`;
  }

  function formatCite(r: BiblioReference, style: CiteStyle): string {
    if (style === 'apa') return formatAPA(r);
    if (style === 'nature') return formatNature(r);
    if (style === 'chicago') return formatChicago(r);
    return formatVancouver(r);
  }

  // ── Export ────────────────────────────────────────────────────────────────
  function toBibTeXEntry(r: BiblioReference): string {
    const type = r.type === 'preprint' ? 'misc'
      : r.type === 'book' ? 'book'
      : r.type === 'thesis' ? 'phdthesis'
      : r.type === 'conference' ? 'inproceedings'
      : 'article';
    const au = r.authors.map(a => `${a.family}, ${a.given}`).join(' and ');
    const fields = [
      `  author = {${au}}`,
      `  title = {${r.title}}`,
      r.journal ? `  journal = {${r.journal}}` : '',
      r.year ? `  year = {${r.year}}` : '',
      r.volume ? `  volume = {${r.volume}}` : '',
      r.issue ? `  number = {${r.issue}}` : '',
      r.pages ? `  pages = {${r.pages}}` : '',
      r.doi ? `  doi = {${r.doi}}` : '',
      r.url ? `  url = {${r.url}}` : '',
    ].filter(Boolean).join(',\n');
    return `@${type}{${r.citeKey},\n${fields}\n}`;
  }

  function exportBibTeX(refs: BiblioReference[]) {
    const text = refs.map(toBibTeXEntry).join('\n\n');
    download(text, 'library.bib', 'text/plain');
  }

  function toRIS(r: BiblioReference): string {
    const ty = r.type === 'book' ? 'BOOK' : r.type === 'thesis' ? 'THES'
      : r.type === 'conference' ? 'CONF' : r.type === 'preprint' ? 'ELEC' : 'JOUR';
    const lines = [`TY  - ${ty}`, `TI  - ${r.title}`];
    r.authors.forEach(a => lines.push(`AU  - ${a.family}, ${a.given}`));
    if (r.year) lines.push(`PY  - ${r.year}`);
    if (r.journal) lines.push(`JO  - ${r.journal}`);
    if (r.volume) lines.push(`VL  - ${r.volume}`);
    if (r.issue) lines.push(`IS  - ${r.issue}`);
    if (r.pages) lines.push(`SP  - ${r.pages.split('-')[0]}`, `EP  - ${r.pages.split('-')[1] ?? ''}`);
    if (r.doi) lines.push(`DO  - ${r.doi}`);
    if (r.url) lines.push(`UR  - ${r.url}`);
    if (r.abstract) lines.push(`AB  - ${r.abstract}`);
    lines.push('ER  -');
    return lines.join('\n');
  }

  function exportRIS(refs: BiblioReference[]) {
    const text = refs.map(toRIS).join('\n\n');
    download(text, 'library.ris', 'text/plain');
  }

  function download(content: string, filename: string, mime: string) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = filename;
    a.click();
  }

  async function copyToClipboard(text: string) {
    try { await navigator.clipboard.writeText(text); showToast('Copied!'); }
    catch { showToast('Copy failed'); }
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function doImport() {
    if (!importQuery.trim() && importMode !== 'bibtex' && importMode !== 'manual') return;
    importLoading = true;
    importError = '';
    importPreview = null;
    try {
      if (importMode === 'doi') importPreview = await fetchByDOI(importQuery);
      else if (importMode === 'pmid') importPreview = await fetchByPMID(importQuery);
      else if (importMode === 'arxiv') importPreview = await fetchByArxiv(importQuery);
      else if (importMode === 'bibtex') {
        const isRIS = bibtexRaw.trimStart().startsWith('TY  -') || bibtexRaw.includes('\nER  -');
        const parsed = isRIS ? parseRIS(bibtexRaw) : parseBibTeX(bibtexRaw);
        if (!parsed.length) throw new Error('No entries found — check format');
        const added = confirmBulkImport(parsed);
        showToast(`Imported ${added} reference${added !== 1 ? 's' : ''}`);
        showImport = false;
        return;
      }
    } catch (e: any) {
      importError = e.message ?? 'Import failed';
    } finally {
      importLoading = false;
    }
  }

  function confirmSingleImport() {
    if (!importPreview) return;
    const dup = detectDuplicate(importPreview);
    if (dup) { showToast(`Already in library: "${dup.title.slice(0, 40)}..."`); return; }
    const ref = makeRef({ ...importPreview, citeKey: generateCiteKey(importPreview) });
    store.biblioRefs = [...store.biblioRefs, ref];
    store.saveBiblio();
    showToast('Reference added');
    showImport = false;
    importQuery = '';
    importPreview = null;
    selectedId = ref.id;
    showDetail = true;
  }

  function confirmBulkImport(partials: Partial<BiblioReference>[]): number {
    let added = 0;
    const newRefs = [...store.biblioRefs];
    for (const p of partials) {
      if (detectDuplicate(p)) continue;
      newRefs.push(makeRef({ ...p, citeKey: generateCiteKey(p) }));
      added++;
    }
    store.biblioRefs = newRefs;
    store.saveBiblio();
    return added;
  }

  function addManualRef() {
    const dup = detectDuplicate(manualForm);
    if (dup) { showToast('Duplicate found'); return; }
    const ref = makeRef({ ...manualForm, citeKey: generateCiteKey(manualForm) });
    store.biblioRefs = [...store.biblioRefs, ref];
    store.saveBiblio();
    showToast('Reference added');
    showImport = false;
    selectedId = ref.id;
    showDetail = true;
  }

  function addFromCurated(p: CuratedPaper) {
    const partial: Partial<BiblioReference> = {
      type: 'article', title: p.title, year: p.year, journal: p.journal, doi: p.doi,
      abstract: p.abstract, url: p.doi ? `https://doi.org/${p.doi}` : '',
      source: 'curated',
      authors: p.authors.includes(' et al.')
        ? [{ family: p.authors.split(' ')[0], given: '' }]
        : [{ family: p.authors.split(' ').slice(-1)[0] ?? '', given: p.authors.split(' ').slice(0, -1).join(' ') }]
    };
    if (addedDois.has(p.doi)) { showToast('Already in your library'); return; }
    const ref = makeRef({ ...partial, citeKey: generateCiteKey(partial) });
    store.biblioRefs = [...store.biblioRefs, ref];
    store.saveBiblio();
    showToast('Added to My Library');
  }

  function deleteRef(id: string) {
    store.biblioRefs = store.biblioRefs.filter(r => r.id !== id);
    store.saveBiblio();
    if (selectedId === id) { selectedId = null; showDetail = false; }
    showToast('Deleted');
  }

  function saveEdit() {
    if (!editingRef) return;
    store.biblioRefs = store.biblioRefs.map(r => r.id === editingRef!.id
      ? { ...editingRef!, updatedAt: Date.now() } : r);
    store.saveBiblio();
    editingRef = null;
    showToast('Saved');
  }

  function toggleRating(ref: BiblioReference, star: number) {
    const newRating = (ref.rating === star ? 0 : star) as 0|1|2|3|4|5;
    store.biblioRefs = store.biblioRefs.map(r => r.id === ref.id
      ? { ...r, rating: newRating, updatedAt: Date.now() } : r);
    store.saveBiblio();
  }

  function setStatus(ref: BiblioReference, status: BiblioReadStatus) {
    store.biblioRefs = store.biblioRefs.map(r => r.id === ref.id
      ? { ...r, readStatus: status, updatedAt: Date.now() } : r);
    store.saveBiblio();
  }

  function addCollection() {
    if (!newCollName.trim()) return;
    const coll: BiblioCollection = {
      id: nanoid(), name: newCollName.trim(),
      parentId: newCollParent || null, color: newCollColor
    };
    store.biblioCollections = [...store.biblioCollections, coll];
    store.saveBiblio();
    newCollName = ''; newCollColor = '#6366f1'; newCollParent = '';
    showCollForm = false;
  }

  function deleteCollection(id: string) {
    store.biblioCollections = store.biblioCollections.filter(c => c.id !== id);
    store.biblioRefs = store.biblioRefs.map(r => ({
      ...r, collectionIds: r.collectionIds.filter(c => c !== id)
    }));
    store.saveBiblio();
    if (collectionFilter === id) collectionFilter = '';
  }

  function addTagToEdit(tag: string) {
    if (!editingRef || !tag.trim()) return;
    if (!editingRef.tags.includes(tag.trim())) {
      editingRef = { ...editingRef, tags: [...editingRef.tags, tag.trim()] };
    }
    tagInput = '';
  }

  function removeTagFromEdit(tag: string) {
    if (!editingRef) return;
    editingRef = { ...editingRef, tags: editingRef.tags.filter(t => t !== tag) };
  }

  function selectRef(id: string) {
    selectedId = id;
    showDetail = true;
    editingRef = null;
  }

  const STATUS_COLOR: Record<BiblioReadStatus, string> = {
    unread: '#94a3b8', reading: '#f59e0b', read: '#22c55e', cited: '#6366f1'
  };

  const TYPE_ICONS: Record<BiblioRefType, string> = {
    article: '📄', book: '📚', chapter: '📖', thesis: '🎓',
    preprint: '📋', conference: '🎤', dataset: '📊', software: '💻',
    report: '📑', patent: '⚖️', webpage: '🌐', other: '📌'
  };
</script>

<!-- ═══════════════════════════════════════════════════════════════ TEMPLATE -->
<div class="biblio-root">

  <!-- Tab bar -->
  <div class="biblio-tabs">
    <button class="btab" class:active={activeTab === 'library'} onclick={() => activeTab = 'library'}>
      My Library
      {#if store.biblioRefs.length > 0}
        <span class="tab-count">{store.biblioRefs.length}</span>
      {/if}
    </button>
    <button class="btab" class:active={activeTab === 'curated'} onclick={() => activeTab = 'curated'}>
      Curated Library
      <span class="tab-count">{CURATED.length}</span>
    </button>
    <div class="tab-spacer"></div>
    {#if activeTab === 'library'}
      <button class="btn-import" onclick={() => { showImport = true; importMode = 'doi'; importQuery = ''; importPreview = null; importError = ''; }}>
        + Import
      </button>
    {/if}
  </div>

  <!-- ── MY LIBRARY ─────────────────────────────────────────────────────── -->
  {#if activeTab === 'library'}
  <div class="lib-layout">

    <!-- Sidebar -->
    <aside class="lib-sidebar" class:collapsed={sidebarCollapsed}>
      <button class="collapse-btn" onclick={() => sidebarCollapsed = !sidebarCollapsed} title="Toggle sidebar">
        {sidebarCollapsed ? '›' : '‹'}
      </button>
      {#if !sidebarCollapsed}
      <div class="sidebar-inner">
        <!-- Stats -->
        <div class="lib-stats">
          <span>{store.biblioRefs.length} refs</span>
          <span>·</span>
          <span>{store.biblioCollections.length} collections</span>
          <span>·</span>
          <span>{allTags.length} tags</span>
        </div>

        <!-- Collections -->
        <div class="sidebar-section">
          <div class="sidebar-section-header">
            <span>Collections</span>
            <button class="icon-btn" onclick={() => showCollForm = !showCollForm} title="New collection">+</button>
          </div>
          {#if showCollForm}
          <div class="coll-form">
            <input class="coll-input" bind:value={newCollName} placeholder="Collection name" />
            <div class="coll-form-row">
              <input type="color" bind:value={newCollColor} class="coll-color" />
              <select class="coll-select" bind:value={newCollParent}>
                <option value="">No parent</option>
                {#each store.biblioCollections as c}
                  <option value={c.id}>{c.name}</option>
                {/each}
              </select>
            </div>
            <button class="btn-sm-primary" onclick={addCollection}>Create</button>
          </div>
          {/if}
          <button class="coll-item" class:active={collectionFilter === ''} onclick={() => collectionFilter = ''}>
            All References
          </button>
          <button class="coll-item" class:active={collectionFilter === '__uncollected'} onclick={() => collectionFilter = '__uncollected'}>
            Uncollected
          </button>
          {#each store.biblioCollections.filter(c => !c.parentId) as coll}
            <div class="coll-tree">
              <div class="coll-item coll-has-color" class:active={collectionFilter === coll.id}
                onclick={() => collectionFilter = coll.id}
                role="button" tabindex="0"
                onkeydown={e => e.key === 'Enter' && (collectionFilter = coll.id)}
                style="--coll-color:{coll.color}">
                <span class="coll-dot"></span>
                <span class="coll-name">{coll.name}</span>
                <span class="coll-count">{store.biblioRefs.filter(r => r.collectionIds.includes(coll.id)).length}</span>
                <button class="coll-del" onclick={(e) => { e.stopPropagation(); deleteCollection(coll.id); }} title="Delete">×</button>
              </div>
              {#each store.biblioCollections.filter(c => c.parentId === coll.id) as sub}
                <div class="coll-item coll-sub coll-has-color" class:active={collectionFilter === sub.id}
                  onclick={() => collectionFilter = sub.id}
                  role="button" tabindex="0"
                  onkeydown={e => e.key === 'Enter' && (collectionFilter = sub.id)}
                  style="--coll-color:{sub.color}">
                  <span class="coll-dot"></span>
                  <span class="coll-name">{sub.name}</span>
                  <span class="coll-count">{store.biblioRefs.filter(r => r.collectionIds.includes(sub.id)).length}</span>
                  <button class="coll-del" onclick={(e) => { e.stopPropagation(); deleteCollection(sub.id); }} title="Delete">×</button>
                </div>
              {/each}
            </div>
          {/each}
        </div>

        <!-- Tags -->
        {#if allTags.length > 0}
        <div class="sidebar-section">
          <div class="sidebar-section-header"><span>Tags</span></div>
          <div class="tag-cloud">
            {#each allTags as tag}
              <button class="tag-chip" class:active={tagFilter === tag}
                onclick={() => tagFilter = tagFilter === tag ? '' : tag}>
                {tag}
              </button>
            {/each}
          </div>
        </div>
        {/if}
      </div>
      {/if}
    </aside>

    <!-- Main area -->
    <div class="lib-main">
      <!-- Search & filters -->
      <div class="lib-toolbar">
        <input class="search-box" bind:value={search} placeholder="Search title, author, journal, tag…" />
        <select class="filter-sel" bind:value={typeFilter}>
          <option value="">All types</option>
          <option value="article">Article</option>
          <option value="book">Book</option>
          <option value="chapter">Chapter</option>
          <option value="thesis">Thesis</option>
          <option value="preprint">Preprint</option>
          <option value="conference">Conference</option>
          <option value="dataset">Dataset</option>
          <option value="software">Software</option>
          <option value="report">Report</option>
          <option value="other">Other</option>
        </select>
        <select class="filter-sel" bind:value={statusFilter}>
          <option value="">All statuses</option>
          <option value="unread">Unread</option>
          <option value="reading">Reading</option>
          <option value="read">Read</option>
          <option value="cited">Cited</option>
        </select>
        <input class="year-input" bind:value={yearFrom} placeholder="From" type="number" min="1900" max="2099" />
        <input class="year-input" bind:value={yearTo} placeholder="To" type="number" min="1900" max="2099" />
        <select class="filter-sel" bind:value={sortBy} title="Sort by">
          <option value="added">Newest added</option>
          <option value="year-desc">Year ↓</option>
          <option value="year-asc">Year ↑</option>
          <option value="author">Author A–Z</option>
          <option value="title">Title A–Z</option>
          <option value="rating">Rating ↓</option>
        </select>
        <button class="select-btn" class:active={selectMode} onclick={() => { selectMode = !selectMode; if (!selectMode) selectedIds = new Set(); }} title="Select multiple">
          {selectMode ? `✓ ${selectedIds.size} sel.` : 'Select'}
        </button>
        {#if search || typeFilter || statusFilter || collectionFilter || tagFilter || yearFrom || yearTo}
          <button class="clear-btn" onclick={() => { search=''; typeFilter=''; statusFilter=''; collectionFilter=''; tagFilter=''; yearFrom=''; yearTo=''; }}>
            Clear
          </button>
        {/if}
      </div>
      {#if selectMode && selectedIds.size > 0}
      <div class="bulk-bar">
        <span class="bulk-label">{selectedIds.size} selected</span>
        {#each store.biblioCollections as c}
          <button class="bulk-coll-btn" onclick={() => bulkMoveToCollection(c.id)}>→ {c.name}</button>
        {/each}
        <button class="bulk-del-btn" onclick={bulkDelete}>Delete all</button>
      </div>
      {/if}

      <!-- Export bar -->
      {#if store.biblioRefs.length > 0}
      <div class="export-bar">
        <span class="export-label">{filteredRefs.length} reference{filteredRefs.length !== 1 ? 's' : ''}</span>
        <button class="export-btn" onclick={() => exportBibTeX(filteredRefs)}>Export BibTeX</button>
        <button class="export-btn" onclick={() => exportRIS(filteredRefs)}>Export RIS</button>
      </div>
      {/if}

      <!-- Reference list -->
      <div class="ref-list" class:has-detail={showDetail}>
        {#if filteredRefs.length === 0}
          <div class="empty-state">
            {#if store.biblioRefs.length === 0}
              <div class="empty-icon">📚</div>
              <div class="empty-title">Your library is empty</div>
              <div class="empty-sub">Import references by DOI, PMID, arXiv ID, BibTeX, or add manually.</div>
              <button class="btn-import-big" onclick={() => { showImport = true; importMode = 'doi'; }}>+ Import your first reference</button>
            {:else}
              <div class="empty-icon">🔍</div>
              <div class="empty-title">No matches</div>
              <div class="empty-sub">Try adjusting your search or filters.</div>
            {/if}
          </div>
        {:else}
          {#each filteredRefs as ref (ref.id)}
            <div class="ref-card" class:selected={selectedId === ref.id} class:batch-selected={selectedIds.has(ref.id)}
              onclick={() => selectMode ? toggleSelectRef(ref.id) : selectRef(ref.id)}
              role="button" tabindex="0" onkeydown={e => e.key === 'Enter' && (selectMode ? toggleSelectRef(ref.id) : selectRef(ref.id))}>
              <div class="ref-card-header">
                {#if selectMode}
                  <input type="checkbox" class="ref-check" checked={selectedIds.has(ref.id)} onclick={(e) => { e.stopPropagation(); toggleSelectRef(ref.id); }} />
                {:else}
                  <span class="ref-type-icon" title={ref.type}>{TYPE_ICONS[ref.type]}</span>
                {/if}
                <div class="ref-title">{ref.title}</div>
                <span class="ref-status-dot" style="background:{STATUS_COLOR[ref.readStatus]}" title={ref.readStatus}></span>
              </div>
              <div class="ref-meta">
                {#if ref.authors.length > 0}<span class="ref-authors">{authorStr(ref.authors)}</span>{/if}
                {#if ref.year}<span class="ref-year">{ref.year}</span>{/if}
                {#if ref.journal}<span class="ref-journal">{ref.journal}</span>{/if}
                {#if ref.doi}<span class="ref-doi-chip">DOI</span>{/if}
                {#if ref.pdfUrl}<span class="ref-oa-chip">OA</span>{/if}
              </div>
              {#if ref.tags.length > 0}
              <div class="ref-tags">
                {#each ref.tags as tag}
                  <span class="ref-tag">{tag}</span>
                {/each}
              </div>
              {/if}
              {#if ref.rating > 0}
              <div class="ref-stars-small">{'★'.repeat(ref.rating)}{'☆'.repeat(5 - ref.rating)}</div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Detail panel -->
    {#if showDetail && selectedRef}
    <aside class="detail-panel">
      <div class="detail-header">
        <span class="detail-type-icon">{TYPE_ICONS[selectedRef.type]}</span>
        <button class="detail-close" onclick={() => { showDetail = false; selectedId = null; }}>×</button>
      </div>

      {#if editingRef && editingRef.id === selectedRef.id}
        <!-- Edit mode -->
        <div class="detail-edit">
          <label class="edit-label">Title
            <input class="edit-input" bind:value={editingRef.title} />
          </label>
          <label class="edit-label">Journal / Source
            <input class="edit-input" bind:value={editingRef.journal} />
          </label>
          <div class="edit-row">
            <label class="edit-label half">Year <input class="edit-input" type="number" bind:value={editingRef.year} /></label>
            <label class="edit-label half">Volume <input class="edit-input" bind:value={editingRef.volume} /></label>
            <label class="edit-label half">Issue <input class="edit-input" bind:value={editingRef.issue} /></label>
            <label class="edit-label half">Pages <input class="edit-input" bind:value={editingRef.pages} /></label>
          </div>
          <label class="edit-label">DOI <input class="edit-input" bind:value={editingRef.doi} /></label>
          <label class="edit-label">PMID <input class="edit-input" bind:value={editingRef.pmid} /></label>
          <label class="edit-label">URL <input class="edit-input" bind:value={editingRef.url} /></label>
          <label class="edit-label">PDF URL <input class="edit-input" bind:value={editingRef.pdfUrl} /></label>
          <label class="edit-label">Cite Key <input class="edit-input" bind:value={editingRef.citeKey} /></label>
          <label class="edit-label">Abstract <textarea class="edit-ta" rows="4" bind:value={editingRef.abstract}></textarea></label>
          <label class="edit-label">Notes <textarea class="edit-ta" rows="3" bind:value={editingRef.notes}></textarea></label>
          <div class="edit-label">Tags
            <div class="tag-edit-row">
              <input class="tag-edit-input" bind:value={tagInput} placeholder="Add tag…"
                onkeydown={e => { if (e.key === 'Enter') { e.preventDefault(); addTagToEdit(tagInput); } }} />
              <button class="btn-sm" onclick={() => addTagToEdit(tagInput)}>Add</button>
            </div>
            <div class="tag-edit-list">
              {#each editingRef.tags as tag}
                <span class="tag-chip-edit">{tag} <button onclick={() => removeTagFromEdit(tag)}>×</button></span>
              {/each}
            </div>
          </div>
          <div class="edit-actions">
            <button class="btn-sm-primary" onclick={saveEdit}>Save</button>
            <button class="btn-sm" onclick={() => editingRef = null}>Cancel</button>
          </div>
        </div>

      {:else}
        <!-- View mode -->
        <div class="detail-view">
          <div class="detail-title">{selectedRef.title}</div>
          <div class="detail-authors">{authorStr(selectedRef.authors, 10)}</div>
          {#if selectedRef.year || selectedRef.journal}
          <div class="detail-meta-row">
            {#if selectedRef.journal}<span class="detail-journal">{selectedRef.journal}</span>{/if}
            {#if selectedRef.year}<span class="detail-year">{selectedRef.year}</span>{/if}
            {#if selectedRef.volume}<span class="detail-vol">{selectedRef.volume}</span>{/if}
            {#if selectedRef.issue}<span class="detail-iss">({selectedRef.issue})</span>{/if}
            {#if selectedRef.pages}<span class="detail-pages">:{selectedRef.pages}</span>{/if}
          </div>
          {/if}

          <!-- IDs -->
          <div class="detail-ids">
            {#if selectedRef.doi}
              <a class="id-chip doi-chip" href="https://doi.org/{selectedRef.doi}" target="_blank" rel="noopener">DOI ↗</a>
            {/if}
            {#if selectedRef.pmid}
              <a class="id-chip pmid-chip" href="https://pubmed.ncbi.nlm.nih.gov/{selectedRef.pmid}/" target="_blank" rel="noopener">PubMed ↗</a>
            {/if}
            {#if selectedRef.arxivId}
              <a class="id-chip arxiv-chip" href="https://arxiv.org/abs/{selectedRef.arxivId}" target="_blank" rel="noopener">arXiv ↗</a>
            {/if}
            {#if selectedRef.pdfUrl}
              <a class="id-chip pdf-chip" href={selectedRef.pdfUrl} target="_blank" rel="noopener">PDF (OA) ↗</a>
            {/if}
          </div>

          <!-- Status & rating -->
          <div class="detail-status-row">
            <span class="detail-status-label">Status:</span>
            {#each (['unread', 'reading', 'read', 'cited'] as BiblioReadStatus[]) as s}
              <button class="status-btn" class:active={selectedRef.readStatus === s}
                style="--sc:{STATUS_COLOR[s]}" onclick={() => setStatus(selectedRef!, s)}>
                {s}
              </button>
            {/each}
          </div>
          <div class="detail-rating">
            {#each [1,2,3,4,5] as star}
              <button class="star-btn" class:filled={selectedRef.rating >= star}
                onclick={() => toggleRating(selectedRef!, star)}>★</button>
            {/each}
          </div>

          <!-- Tags -->
          {#if selectedRef.tags.length > 0}
          <div class="detail-tags">
            {#each selectedRef.tags as tag}
              <span class="ref-tag">{tag}</span>
            {/each}
          </div>
          {/if}

          <!-- Abstract -->
          {#if selectedRef.abstract}
          <details class="detail-abstract">
            <summary>Abstract</summary>
            <p>{selectedRef.abstract}</p>
          </details>
          {/if}

          <!-- Notes -->
          {#if selectedRef.notes}
          <div class="detail-notes">
            <div class="detail-section-label">Notes</div>
            <p>{selectedRef.notes}</p>
          </div>
          {/if}

          <!-- Cite key -->
          <div class="detail-citekey">
            <span class="detail-section-label">Cite key:</span>
            <code>{selectedRef.citeKey}</code>
          </div>

          <!-- Citation -->
          <div class="detail-cite-block">
            <div class="cite-style-row">
              {#each (['vancouver', 'apa', 'nature', 'chicago'] as CiteStyle[]) as s}
                <button class="cite-style-btn" class:active={citeStyle === s} onclick={() => citeStyle = s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              {/each}
            </div>
            <div class="cite-text">{formatCite(selectedRef, citeStyle)}</div>
            <button class="copy-btn" onclick={() => copyToClipboard(formatCite(selectedRef!, citeStyle))}>
              Copy Citation
            </button>
          </div>

          <!-- Citation count -->
          <div class="detail-cite-count">
            {#if selectedRef.citationCount !== null}
              <span class="cite-count-badge">{selectedRef.citationCount} citations</span>
            {/if}
            {#if selectedRef.doi}
              <button class="export-btn-sm" disabled={citeFetchingId === selectedRef.id}
                onclick={() => fetchCitationCount(selectedRef!)}>
                {citeFetchingId === selectedRef.id ? 'Fetching…' : 'Get citation count'}
              </button>
            {/if}
          </div>

          <!-- Collections assignment -->
          {#if store.biblioCollections.length > 0}
          <div class="detail-collections">
            <div class="detail-section-label">Collections</div>
            <div class="detail-coll-list">
              {#each store.biblioCollections as coll}
                <button class="detail-coll-chip"
                  class:in-coll={selectedRef.collectionIds.includes(coll.id)}
                  style="--coll-color:{coll.color}"
                  onclick={() => toggleCollectionOnRef(selectedRef!, coll.id)}>
                  <span class="coll-dot"></span>
                  {coll.name}
                  {#if selectedRef.collectionIds.includes(coll.id)}<span class="coll-check">✓</span>{/if}
                </button>
              {/each}
            </div>
          </div>
          {/if}

          <!-- Export single -->
          <div class="detail-export-row">
            <button class="export-btn-sm" onclick={() => exportBibTeX([selectedRef!])}>Export BibTeX</button>
            <button class="export-btn-sm" onclick={() => exportRIS([selectedRef!])}>Export RIS</button>
          </div>

          <!-- Actions -->
          <div class="detail-action-row">
            <button class="btn-sm-primary" onclick={() => editingRef = { ...selectedRef! }}>Edit</button>
            <button class="btn-sm-danger" onclick={() => deleteRef(selectedRef!.id)}>Delete</button>
          </div>
        </div>
      {/if}
    </aside>
    {/if}
  </div>
  {/if}

  <!-- ── CURATED LIBRARY ─────────────────────────────────────────────────── -->
  {#if activeTab === 'curated'}
  <div class="curated-root">
    <div class="curated-toolbar">
      <input class="search-box" bind:value={curatedSearch} placeholder="Search curated papers…" />
    </div>
    <div class="category-chips">
      <button class="cat-chip" class:active={curatedCategory === ''} onclick={() => curatedCategory = ''}>
        All ({CURATED.length})
      </button>
      {#each CATEGORIES as cat}
        <button class="cat-chip" class:active={curatedCategory === cat} onclick={() => curatedCategory = curatedCategory === cat ? '' : cat}>
          {cat} ({CURATED.filter(p => p.category === cat).length})
        </button>
      {/each}
    </div>
    <div class="curated-grid">
      {#each filteredCurated as paper (paper.doi)}
        {@const isAdded = addedDois.has(paper.doi)}
        <div class="curated-card" class:added={isAdded}>
          <div class="curated-card-header">
            <span class="cat-badge">{paper.category}</span>
            {#if isAdded}<span class="added-badge">✓ In Library</span>{/if}
          </div>
          <div class="curated-title">{paper.title}</div>
          <div class="curated-meta">
            <span>{paper.authors}</span>
            <span class="curated-year">{paper.year}</span>
            <span class="curated-journal">{paper.journal}</span>
          </div>
          <p class="curated-abstract">{paper.abstract}</p>
          <div class="curated-actions">
            {#if paper.doi}
              <a class="id-chip doi-chip sm" href="https://doi.org/{paper.doi}" target="_blank" rel="noopener">DOI ↗</a>
            {/if}
            <button class="btn-add-lib" disabled={isAdded} onclick={() => addFromCurated(paper)}>
              {isAdded ? '✓ Added' : '+ Add to My Library'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
  {/if}

  <!-- ── IMPORT MODAL ───────────────────────────────────────────────────── -->
  {#if showImport}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal-box">
      <div class="modal-header">
        <span class="modal-title">Import Reference</span>
        <button class="modal-close" onclick={() => { showImport = false; importPreview = null; importError = ''; }}>×</button>
      </div>
      <div class="import-tabs">
        {#each (['doi', 'pmid', 'arxiv', 'bibtex', 'manual'] as ImportMode[]) as mode}
          <button class="import-tab" class:active={importMode === mode} onclick={() => { importMode = mode; importPreview = null; importError = ''; }}>
            {mode === 'doi' ? 'DOI' : mode === 'pmid' ? 'PMID' : mode === 'arxiv' ? 'arXiv' : mode === 'bibtex' ? 'BibTeX/RIS' : 'Manual'}
          </button>
        {/each}
      </div>

      {#if importMode === 'manual'}
        <div class="manual-form">
          <label class="edit-label">Type
            <select class="edit-input" bind:value={manualForm.type}>
              {#each ['article','book','chapter','thesis','preprint','conference','dataset','software','report','patent','webpage','other'] as t}
                <option value={t}>{t}</option>
              {/each}
            </select>
          </label>
          <label class="edit-label">Title <input class="edit-input" bind:value={manualForm.title} /></label>
          <label class="edit-label">Authors (Last, First — one per line)
            <textarea class="edit-ta" rows="3" placeholder="Smith, John&#10;Doe, Jane"
              oninput={(e) => {
                const lines = (e.currentTarget as HTMLTextAreaElement).value.split('\n').filter(l => l.trim());
                manualForm.authors = lines.map(l => {
                  const [fam, giv] = l.split(',');
                  return { family: fam?.trim() ?? '', given: giv?.trim() ?? '' };
                });
              }}></textarea>
          </label>
          <div class="edit-row">
            <label class="edit-label half">Year <input class="edit-input" type="number" bind:value={manualForm.year} /></label>
            <label class="edit-label half">Volume <input class="edit-input" bind:value={manualForm.volume} /></label>
            <label class="edit-label half">Issue <input class="edit-input" bind:value={manualForm.issue} /></label>
            <label class="edit-label half">Pages <input class="edit-input" bind:value={manualForm.pages} /></label>
          </div>
          <label class="edit-label">Journal / Source <input class="edit-input" bind:value={manualForm.journal} /></label>
          <label class="edit-label">DOI <input class="edit-input" bind:value={manualForm.doi} /></label>
          <label class="edit-label">URL <input class="edit-input" bind:value={manualForm.url} /></label>
          <label class="edit-label">Abstract <textarea class="edit-ta" rows="3" bind:value={manualForm.abstract}></textarea></label>
          <button class="btn-import-big" onclick={addManualRef}>Add to Library</button>
        </div>

      {:else if importMode === 'bibtex'}
        <div class="bibtex-form">
          <label class="edit-label">Paste BibTeX or RIS
            <textarea class="edit-ta big" rows="12" bind:value={bibtexRaw} placeholder={bibtexPlaceholder}></textarea>
          </label>
          <button class="btn-import-big" onclick={doImport}>Import All</button>
        </div>

      {:else}
        <div class="lookup-form">
          <div class="lookup-hint">
            {#if importMode === 'doi'}Enter a DOI, e.g. <code>10.1056/NEJMoa1606774</code>{/if}
            {#if importMode === 'pmid'}Enter a PubMed ID, e.g. <code>27718847</code>{/if}
            {#if importMode === 'arxiv'}Enter an arXiv ID, e.g. <code>1802.03426</code>{/if}
          </div>
          <div class="lookup-row">
            <input class="edit-input" bind:value={importQuery}
              placeholder={importMode === 'doi' ? '10.xxxx/…' : importMode === 'pmid' ? 'PMID' : 'arXiv ID'}
              onkeydown={e => e.key === 'Enter' && doImport()} />
            <button class="btn-import-big" disabled={importLoading} onclick={doImport}>
              {importLoading ? 'Looking up…' : 'Look up'}
            </button>
          </div>
          {#if importError}
            <div class="import-error">{importError}</div>
          {/if}
          {#if importPreview}
            <div class="import-preview">
              <div class="preview-title">{importPreview.title}</div>
              <div class="preview-meta">
                {#if importPreview.authors?.length}{authorStr(importPreview.authors as BiblioAuthor[])}{/if}
                {#if importPreview.year} · {importPreview.year}{/if}
                {#if importPreview.journal} · {importPreview.journal}{/if}
              </div>
              {#if importPreview.doi}<div class="preview-doi">DOI: {importPreview.doi}</div>{/if}
              {#if importPreview.abstract}
                <p class="preview-abstract">{importPreview.abstract.slice(0, 300)}{importPreview.abstract.length > 300 ? '…' : ''}</p>
              {/if}
              <button class="btn-import-big" onclick={confirmSingleImport}>Add to Library</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
  {/if}

  <!-- Toast -->
  {#if toastMsg}
    <div class="toast">{toastMsg}</div>
  {/if}
</div>

<!-- ═══════════════════════════════════════════════════════════════════ STYLE -->
<style>
.biblio-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg, #0f172a);
  color: var(--text, #e2e8f0);
  font-size: 0.875rem;
  position: relative;
}

/* Tabs */
.biblio-tabs {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem 1rem 0;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.btab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.875rem;
  transition: color 0.15s, border-color 0.15s;
}
.btab.active { color: #e2e8f0; border-bottom-color: #6366f1; }
.tab-count { background: #1e293b; padding: 0.1rem 0.4rem; border-radius: 999px; font-size: 0.7rem; }
.tab-spacer { flex: 1; }
.btn-import {
  padding: 0.35rem 0.9rem;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
}
.btn-import:hover { background: #818cf8; }

/* Layout */
.lib-layout {
  display: grid;
  grid-template-columns: auto 1fr auto;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.lib-sidebar {
  width: 200px;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  transition: width 0.2s;
  position: relative;
  flex-shrink: 0;
}
.lib-sidebar.collapsed { width: 24px; }
.collapse-btn {
  position: absolute;
  top: 0.5rem;
  right: 0;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  font-size: 1rem;
  z-index: 1;
}
.sidebar-inner { padding: 0.5rem 0.5rem 1rem; overflow: hidden; }
.lib-stats { font-size: 0.7rem; color: #64748b; padding: 0.5rem 0.25rem; display: flex; gap: 0.3rem; flex-wrap: wrap; }
.sidebar-section { margin-top: 0.75rem; }
.sidebar-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.25rem 0.3rem;
}
.icon-btn { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 1.1rem; padding: 0; }
.coll-item {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: #94a3b8;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.coll-item:hover { background: #1e293b; color: #e2e8f0; }
.coll-item.active { background: #1e293b; color: #e2e8f0; }
.coll-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--coll-color, #6366f1);
  flex-shrink: 0;
}
.coll-count { margin-left: auto; font-size: 0.7rem; color: #475569; }
.coll-del { background: none; border: none; color: #475569; cursor: pointer; padding: 0 0.2rem; font-size: 0.9rem; }
.coll-del:hover { color: #ef4444; }
.coll-sub { padding-left: 1.5rem; }
.coll-form { padding: 0.5rem; background: #1e293b; border-radius: 6px; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem; }
.coll-form-row { display: flex; gap: 0.4rem; }
.coll-input, .coll-select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; border-radius: 4px; padding: 0.25rem 0.4rem; font-size: 0.75rem; width: 100%; }
.coll-color { width: 28px; height: 28px; padding: 0; border: none; cursor: pointer; border-radius: 4px; flex-shrink: 0; }
.btn-sm-primary { background: #6366f1; color: #fff; border: none; border-radius: 4px; padding: 0.25rem 0.6rem; cursor: pointer; font-size: 0.75rem; }
.btn-sm { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; border-radius: 4px; padding: 0.25rem 0.6rem; cursor: pointer; font-size: 0.75rem; }
.btn-sm-danger { background: #7f1d1d; color: #fca5a5; border: none; border-radius: 4px; padding: 0.25rem 0.6rem; cursor: pointer; font-size: 0.75rem; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.tag-chip {
  background: #1e293b; border: 1px solid #334155; color: #94a3b8;
  padding: 0.15rem 0.5rem; border-radius: 999px; cursor: pointer; font-size: 0.7rem;
}
.tag-chip.active { background: #312e81; border-color: #6366f1; color: #c7d2fe; }

/* Main area */
.lib-main { display: flex; flex-direction: column; overflow: hidden; }
.lib-toolbar {
  display: flex;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
}
.search-box {
  flex: 1;
  min-width: 160px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 6px;
  padding: 0.35rem 0.7rem;
  font-size: 0.8rem;
}
.filter-sel, .year-input {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
}
.year-input { width: 72px; }
.clear-btn { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.78rem; }
.clear-btn:hover { color: #ef4444; }
.export-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.75rem;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.export-label { color: #64748b; font-size: 0.78rem; margin-right: auto; }
.export-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.75rem; }
.export-btn:hover { color: #e2e8f0; }

.ref-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ref-list.has-detail { }

/* Reference card */
.ref-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ref-card:hover { border-color: #475569; background: #243044; }
.ref-card.selected { border-color: #6366f1; background: #1e1b4b; }
.ref-card-header { display: flex; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.3rem; }
.ref-type-icon { font-size: 0.9rem; flex-shrink: 0; margin-top: 0.1rem; }
.ref-title { font-size: 0.83rem; font-weight: 500; color: #e2e8f0; line-height: 1.4; flex: 1; }
.ref-status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 0.4rem; }
.ref-meta { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; font-size: 0.75rem; color: #64748b; }
.ref-authors { color: #94a3b8; }
.ref-year { color: #64748b; }
.ref-journal { color: #64748b; font-style: italic; }
.ref-doi-chip, .ref-oa-chip {
  padding: 0.05rem 0.35rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
}
.ref-doi-chip { background: #164e63; color: #67e8f9; }
.ref-oa-chip { background: #14532d; color: #86efac; }
.ref-tags { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: 0.3rem; }
.ref-tag { background: #0f172a; border: 1px solid #334155; color: #64748b; padding: 0.05rem 0.4rem; border-radius: 999px; font-size: 0.68rem; }
.ref-stars-small { font-size: 0.7rem; color: #f59e0b; margin-top: 0.2rem; }

/* Empty state */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; gap: 0.6rem; }
.empty-icon { font-size: 2.5rem; }
.empty-title { font-size: 1rem; font-weight: 500; color: #e2e8f0; }
.empty-sub { color: #64748b; font-size: 0.8rem; max-width: 320px; }
.btn-import-big {
  margin-top: 0.5rem;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.2rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
}
.btn-import-big:hover { background: #818cf8; }
.btn-import-big:disabled { background: #334155; color: #64748b; cursor: default; }

/* Detail panel */
.detail-panel {
  width: 320px;
  border-left: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  background: #0f172a;
  flex-shrink: 0;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0.5rem;
  border-bottom: 1px solid #1e293b;
  flex-shrink: 0;
}
.detail-type-icon { font-size: 1.2rem; }
.detail-close { background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.2rem; }
.detail-close:hover { color: #e2e8f0; }
.detail-view, .detail-edit { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.detail-title { font-size: 0.9rem; font-weight: 600; color: #e2e8f0; line-height: 1.4; }
.detail-authors { font-size: 0.8rem; color: #94a3b8; }
.detail-meta-row { display: flex; flex-wrap: wrap; gap: 0.25rem; font-size: 0.78rem; color: #64748b; }
.detail-journal { font-style: italic; }
.detail-ids { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.id-chip {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.72rem;
  text-decoration: none;
  font-weight: 500;
}
.doi-chip { background: #164e63; color: #67e8f9; }
.pmid-chip { background: #1c1917; color: #a8a29e; border: 1px solid #44403c; }
.arxiv-chip { background: #451a03; color: #fb923c; }
.pdf-chip { background: #14532d; color: #86efac; }
.id-chip.sm { font-size: 0.68rem; }
.detail-status-row { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
.detail-status-label { font-size: 0.75rem; color: #64748b; }
.status-btn {
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--sc);
  background: none;
  color: var(--sc);
  cursor: pointer;
  font-size: 0.72rem;
}
.status-btn.active { background: var(--sc); color: #0f172a; }
.detail-rating { display: flex; gap: 0.1rem; }
.star-btn { background: none; border: none; color: #334155; cursor: pointer; font-size: 1.2rem; padding: 0; }
.star-btn.filled { color: #f59e0b; }
.detail-tags { display: flex; flex-wrap: wrap; gap: 0.2rem; }
.detail-abstract { font-size: 0.78rem; color: #94a3b8; }
.detail-abstract summary { cursor: pointer; color: #64748b; font-size: 0.75rem; }
.detail-abstract p { margin-top: 0.4rem; line-height: 1.5; }
.detail-notes { font-size: 0.78rem; color: #94a3b8; }
.detail-section-label { font-size: 0.7rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.2rem; }
.detail-citekey { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; }
.detail-citekey code { background: #1e293b; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.78rem; }
.detail-cite-block { background: #1e293b; border-radius: 6px; padding: 0.6rem; display: flex; flex-direction: column; gap: 0.5rem; }
.cite-style-row { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.cite-style-btn { background: none; border: 1px solid #334155; color: #64748b; padding: 0.15rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem; }
.cite-style-btn.active { background: #312e81; border-color: #6366f1; color: #c7d2fe; }
.cite-text { font-size: 0.75rem; color: #e2e8f0; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.copy-btn { background: #6366f1; color: #fff; border: none; border-radius: 4px; padding: 0.25rem 0.7rem; cursor: pointer; font-size: 0.75rem; align-self: flex-start; }
.detail-export-row { display: flex; gap: 0.4rem; }
.export-btn-sm { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem; }
.detail-action-row { display: flex; gap: 0.5rem; margin-top: 0.25rem; }

/* Edit form */
.edit-label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.75rem; color: #64748b; }
.edit-input {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
}
.edit-ta {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.78rem;
  resize: vertical;
  font-family: inherit;
}
.edit-ta.big { min-height: 200px; }
.edit-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.edit-label.half { flex: 1; min-width: 60px; }
.tag-edit-row { display: flex; gap: 0.3rem; margin-top: 0.2rem; }
.tag-edit-input { flex: 1; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; border-radius: 4px; padding: 0.25rem 0.4rem; font-size: 0.75rem; }
.tag-edit-list { display: flex; flex-wrap: wrap; gap: 0.2rem; margin-top: 0.3rem; }
.tag-chip-edit { background: #312e81; border: 1px solid #6366f1; color: #c7d2fe; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.2rem; }
.tag-chip-edit button { background: none; border: none; color: #a5b4fc; cursor: pointer; padding: 0; font-size: 0.75rem; }
.edit-actions { display: flex; gap: 0.4rem; }

/* Curated */
.curated-root { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.75rem; }
.curated-toolbar { display: flex; gap: 0.5rem; }
.category-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.cat-chip {
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: all 0.15s;
}
.cat-chip.active { background: #312e81; border-color: #6366f1; color: #c7d2fe; }
.curated-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 0.75rem; }
.curated-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: border-color 0.15s;
}
.curated-card.added { opacity: 0.6; }
.curated-card:hover { border-color: #475569; }
.curated-card-header { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.cat-badge { background: #1c1917; border: 1px solid #44403c; color: #a8a29e; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; }
.added-badge { background: #14532d; color: #86efac; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.68rem; }
.curated-title { font-size: 0.83rem; font-weight: 500; color: #e2e8f0; line-height: 1.4; }
.curated-meta { font-size: 0.75rem; color: #64748b; display: flex; flex-wrap: wrap; gap: 0.3rem; }
.curated-year { color: #64748b; }
.curated-journal { font-style: italic; }
.curated-abstract { font-size: 0.75rem; color: #94a3b8; line-height: 1.4; flex: 1; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.curated-actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.btn-add-lib {
  margin-left: auto;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.7rem;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
}
.btn-add-lib:hover:not(:disabled) { background: #818cf8; }
.btn-add-lib:disabled { background: #334155; color: #64748b; cursor: default; }

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 10px;
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid #1e293b; flex-shrink: 0; }
.modal-title { font-size: 0.95rem; font-weight: 600; color: #e2e8f0; }
.modal-close { background: none; border: none; color: #64748b; cursor: pointer; font-size: 1.3rem; }
.import-tabs { display: flex; gap: 0; border-bottom: 1px solid #1e293b; flex-shrink: 0; }
.import-tab { flex: 1; padding: 0.5rem; background: none; border: none; border-bottom: 2px solid transparent; color: #64748b; cursor: pointer; font-size: 0.78rem; }
.import-tab.active { color: #e2e8f0; border-bottom-color: #6366f1; }
.lookup-form, .manual-form, .bibtex-form { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
.lookup-hint { font-size: 0.78rem; color: #64748b; }
.lookup-row { display: flex; gap: 0.5rem; }
.import-error { color: #fca5a5; font-size: 0.8rem; background: #450a0a; border-radius: 4px; padding: 0.4rem 0.6rem; }
.import-preview { background: #1e293b; border-radius: 6px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem; }
.preview-title { font-size: 0.85rem; font-weight: 500; color: #e2e8f0; line-height: 1.4; }
.preview-meta { font-size: 0.75rem; color: #94a3b8; }
.preview-doi { font-size: 0.72rem; color: #67e8f9; }
.preview-abstract { font-size: 0.75rem; color: #94a3b8; line-height: 1.4; margin: 0; }

/* Toast */
.toast {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 0.5rem 1.2rem;
  border-radius: 6px;
  font-size: 0.82rem;
  z-index: 2000;
  pointer-events: none;
}

/* Sort / select / bulk */
.select-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }
.select-btn.active { border-color: #6366f1; color: #c7d2fe; background: #1e1b4b; }
.ref-check { width: 16px; height: 16px; cursor: pointer; accent-color: #6366f1; flex-shrink: 0; margin-top: 0.15rem; }
.ref-card.batch-selected { border-color: #818cf8; background: #1e1b4b; }
.bulk-bar { display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; background: #1e1b4b; border-bottom: 1px solid #334155; flex-shrink: 0; flex-wrap: wrap; }
.bulk-label { font-size: 0.78rem; color: #c7d2fe; margin-right: 0.25rem; }
.bulk-coll-btn { background: #1e293b; border: 1px solid #334155; color: #94a3b8; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem; }
.bulk-coll-btn:hover { color: #e2e8f0; }
.bulk-del-btn { margin-left: auto; background: #7f1d1d; border: none; color: #fca5a5; padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.72rem; }

/* Citation count */
.detail-cite-count { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.cite-count-badge { background: #164e63; color: #67e8f9; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }

/* Collection assignment */
.detail-collections { display: flex; flex-direction: column; gap: 0.3rem; }
.detail-coll-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.detail-coll-chip {
  display: flex; align-items: center; gap: 0.25rem;
  background: #0f172a; border: 1px solid #334155; color: #64748b;
  padding: 0.2rem 0.5rem; border-radius: 999px; cursor: pointer; font-size: 0.72rem;
}
.detail-coll-chip:hover { border-color: var(--coll-color, #6366f1); color: #e2e8f0; }
.detail-coll-chip.in-coll { background: #1e1b4b; border-color: var(--coll-color, #6366f1); color: #c7d2fe; }
.coll-check { font-size: 0.7rem; color: #86efac; }

@media (max-width: 768px) {
  .lib-layout { grid-template-columns: 1fr; }
  .lib-sidebar { display: none; }
  .detail-panel { width: 100%; border-left: none; border-top: 1px solid #1e293b; max-height: 55vh; }
  .curated-grid { grid-template-columns: 1fr; }
}
</style>
