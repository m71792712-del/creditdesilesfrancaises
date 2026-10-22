-- =====================================================================
-- Crédit des îles françaises — données de référence (idempotent : rejouable sans risque).
-- PROJET. Contient : réglages, 31 motifs, types de carte (2_1.docx), 12 banques (logos fournis).
-- Les territoires et types de banques sont INDICATIFS : l'admin peut les corriger dans l'application.
-- =====================================================================

insert into public.app_settings (key, value) values
  ('loan_min_amount', '500'::jsonb),
  ('loan_max_amount', '100000'::jsonb),
  ('loans_per_hour', '5'::jsonb),
  ('suggestions_per_day', '5'::jsonb),
  ('require_admin_mfa', 'false'::jsonb)
on conflict (key) do nothing;

insert into public.loan_purposes (code, sort_order, label_fr, label_en, requires_details) values
  ('personal', 1, 'Projet personnel', 'Personal project', false),
  ('family', 2, 'Projet familial', 'Family project', false),
  ('real_estate', 3, 'Projet immobilier', 'Real estate project', false),
  ('professional', 4, 'Projet professionnel', 'Professional project', false),
  ('entrepreneurial', 5, 'Projet entrepreneurial', 'Entrepreneurial project', false),
  ('commercial', 6, 'Projet commercial', 'Commercial project', false),
  ('agricultural', 7, 'Projet agricole', 'Agricultural project', false),
  ('livestock', 8, 'Projet d’élevage', 'Livestock farming project', false),
  ('education', 9, 'Projet d’études et de formation', 'Education and training project', false),
  ('construction', 10, 'Projet de construction', 'Construction project', false),
  ('renovation', 11, 'Projet de rénovation', 'Renovation project', false),
  ('equipment', 12, 'Projet d’équipement', 'Equipment project', false),
  ('vehicle', 13, 'Projet d’achat de véhicule', 'Vehicle purchase project', false),
  ('wedding', 14, 'Projet de mariage', 'Wedding project', false),
  ('health', 15, 'Projet de santé', 'Health project', false),
  ('travel', 16, 'Projet de voyage', 'Travel project', false),
  ('investment', 17, 'Projet d’investissement', 'Investment project', false),
  ('business_creation', 18, 'Projet de création d’entreprise', 'Business creation project', false),
  ('business_extension', 19, 'Projet d’extension d’entreprise', 'Business expansion project', false),
  ('land', 20, 'Projet d’achat de terrain', 'Land purchase project', false),
  ('home_improvement', 21, 'Projet d’aménagement de maison', 'Home improvement project', false),
  ('solar', 22, 'Projet d’énergie solaire', 'Solar energy project', false),
  ('transport', 23, 'Projet de transport', 'Transport project', false),
  ('restaurant', 24, 'Projet de restauration', 'Restaurant project', false),
  ('agri_food', 25, 'Projet de transformation agroalimentaire', 'Food processing project', false),
  ('professional_equipment', 26, 'Projet d’achat de matériel professionnel', 'Professional equipment purchase project', false),
  ('stock', 27, 'Projet de financement de stock', 'Stock financing project', false),
  ('activity_development', 28, 'Projet de développement d’activité', 'Business development project', false),
  ('family_reunification', 29, 'Projet de regroupement familial', 'Family reunification project', false),
  ('debt_consolidation', 30, 'Projet de consolidation de dettes', 'Debt consolidation project', false),
  ('other', 31, 'Autre (à préciser)', 'Other (please specify)', true)
on conflict (code) do nothing;

insert into public.card_types (family, name, sort_order) values
  ('Nickel / NewPay', 'NewPay', 1),
  ('Nickel / NewPay', 'Nickel Classic', 2),
  ('Nickel / NewPay', 'My Nickel', 3),
  ('Nickel / NewPay', 'Nickel Chrome', 4),
  ('Nickel / NewPay', 'Nickel Metal', 5),
  ('Visa', 'Visa Classic', 6),
  ('Visa', 'Visa Premier', 7),
  ('Visa', 'Visa Electron', 8),
  ('Visa', 'Visa Platinum', 9),
  ('Visa', 'Visa Infinite', 10),
  ('Visa', 'Visa Gold', 11),
  ('Visa', 'Visa Business', 12),
  ('Visa', 'Visa Infinite Business', 13),
  ('Mastercard', 'Mastercard Standard', 14),
  ('Mastercard', 'Mastercard Classic', 15),
  ('Mastercard', 'Gold Mastercard', 16),
  ('Mastercard', 'Mastercard Platinum', 17),
  ('Mastercard', 'Mastercard World Elite', 18),
  ('Mastercard', 'Mastercard Business', 19),
  ('Autres réseaux', 'Maestro', 20),
  ('Autres réseaux', 'V PAY', 21),
  ('Autres réseaux', 'American Express', 22),
  ('Autres réseaux', 'Carte CB (Cartes Bancaires)', 23),
  ('Types de cartes', 'Carte prépayée', 24),
  ('Types de cartes', 'Carte virtuelle', 25),
  ('Types de cartes', 'Carte à autorisation systématique', 26),
  ('Types de cartes', 'Carte professionnelle', 27),
  ('Types de cartes', 'Carte de débit', 28),
  ('Types de cartes', 'Carte de crédit', 29),
  ('Types de cartes', 'Carte de retrait', 30),
  ('Types de cartes', 'Carte rechargeable', 31),
  ('Types de cartes', 'Carte cadeau bancaire', 32),
  ('Cartes régionales', 'Carte SOCREDO', 33),
  ('Cartes régionales', 'Carte Aircalin', 34)
on conflict (name) do nothing;

-- Le slug correspond au nom du fichier logo du frontend : public/banks/<slug>.webp
insert into public.banks (slug, name, territory, type) values
  ('bnp-paribas-antilles-guyane', 'BNP Paribas Antilles-Guyane', 'Antilles-Guyane', 'bank'),
  ('bred-banque-populaire', 'BRED Banque Populaire', 'France et outre-mer', 'bank'),
  ('caisse-d-epargne-cepac', 'Caisse dÉpargne CEPAC', 'France', 'bank'),
  ('credit-agricole-martinique-guyane', 'Crédit Agricole Martinique-Guyane', 'Martinique-Guyane', 'bank'),
  ('lcl', 'LCL', 'France', 'bank'),
  ('credit-mutuel', 'Crédit Mutuel', 'France', 'bank'),
  ('la-banque-postale', 'La Banque Postale', 'France', 'bank'),
  ('deblock', 'DEBLOCK', 'Non précisé', 'fintech'),
  ('banque-de-tahiti', 'Banque de Tahiti', 'Polynésie française', 'bank'),
  ('banque-de-polynesie', 'Banque de Polynésie', 'Polynésie française', 'bank'),
  ('niupay', 'NiuPay', 'Non précisé', 'fintech'),
  ('socredo', 'SOCREDO', 'Polynésie française', 'bank')
on conflict (slug) do nothing;
