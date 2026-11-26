-- Mis licitaciones: categoría de requisitos para condiciones de ejecución
-- del contrato (social / medioambiental) extraídas del Atom CODICE (intake).

alter table public.offer_requirements
  drop constraint if exists offer_requirements_category_check;

alter table public.offer_requirements
  add constraint offer_requirements_category_check
  check (
    category in (
      'habilitacion',
      'solvencia_economica',
      'solvencia_tecnica',
      'clasificacion',
      'adscripcion_medios',
      'criterio_adjudicacion',
      'garantias',
      'administrativo',
      'condiciones_ejecucion',
      'otros'
    )
  );

comment on column public.offer_requirements.category is
  'Categoría del requisito; condiciones_ejecucion = obligaciones sociales/ambientales del contrato (CODICE ContractExecutionRequirement).';
