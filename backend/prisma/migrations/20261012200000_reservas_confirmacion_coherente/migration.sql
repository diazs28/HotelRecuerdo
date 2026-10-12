-- Toda reserva confirmada, en alojamiento o finalizada registra cuándo se confirmó
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_confirmacion_coherente"
  CHECK ("estado" NOT IN ('CONFIRMADA', 'EN_ALOJAMIENTO', 'FINALIZADA') OR "confirmada_en" IS NOT NULL);
