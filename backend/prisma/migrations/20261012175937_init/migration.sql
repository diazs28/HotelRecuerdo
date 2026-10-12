-- CreateEnum
CREATE TYPE "estado_reserva" AS ENUM ('SOLICITUD', 'PENDIENTE_CONFIRMACION', 'CONFIRMADA', 'EN_ALOJAMIENTO', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "tipo_bloqueo" AS ENUM ('BLOQUEO', 'MANTENIMIENTO');

-- CreateEnum
CREATE TYPE "tipo_ocupacion" AS ENUM ('RESERVA', 'BLOQUEO');

-- CreateEnum
CREATE TYPE "tipo_cama" AS ENUM ('SENCILLA', 'SEMIDOBLE', 'DOBLE', 'QUEEN', 'KING', 'LITERA', 'AUXILIAR');

-- CreateEnum
CREATE TYPE "tipo_documento" AS ENUM ('CC', 'CE', 'PASAPORTE', 'TI', 'PPT', 'OTRO');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol_id" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "version_token" INTEGER NOT NULL DEFAULT 0,
    "ultimo_acceso" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(40) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(60) NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_permisos" (
    "rol_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,

    CONSTRAINT "rol_permisos_pkey" PRIMARY KEY ("rol_id","permiso_id")
);

-- CreateTable
CREATE TABLE "tipos_habitacion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(500),
    "capacidad_sugerida" INTEGER,
    "publicado" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tipos_habitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canales" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" VARCHAR(30) NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "canales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes" (
    "clave" VARCHAR(40) NOT NULL,
    "valor" JSONB NOT NULL,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "actualizado_por_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "habitaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" VARCHAR(30) NOT NULL,
    "tipo_habitacion_id" UUID NOT NULL,
    "capacidad" INTEGER NOT NULL,
    "piso" VARCHAR(20),
    "descripcion" VARCHAR(500),
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "habitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "camas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "habitacion_id" UUID NOT NULL,
    "identificador" VARCHAR(30) NOT NULL,
    "tipo" "tipo_cama" NOT NULL,
    "plazas" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "camas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "tipo_bloqueo" NOT NULL,
    "habitacion_id" UUID NOT NULL,
    "cama_id" UUID,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "motivo" VARCHAR(300) NOT NULL,
    "creado_por_id" UUID NOT NULL,
    "liberado_en" TIMESTAMPTZ(6),
    "liberado_por_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocupaciones_cama" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cama_id" UUID NOT NULL,
    "tipo" "tipo_ocupacion" NOT NULL,
    "reserva_id" UUID,
    "bloqueo_id" UUID,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "liberada_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocupaciones_cama_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "huespedes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "tipo_documento" "tipo_documento",
    "numero_documento" VARCHAR(30),
    "telefono" VARCHAR(30),
    "email" VARCHAR(255),
    "consentimiento_en" TIMESTAMPTZ(6),
    "version_politica" VARCHAR(20),
    "anonimizado_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "huespedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "numero" SERIAL NOT NULL,
    "estado" "estado_reserva" NOT NULL,
    "canal_id" UUID NOT NULL,
    "huesped_id" UUID NOT NULL,
    "fecha_entrada" DATE NOT NULL,
    "fecha_salida" DATE NOT NULL,
    "cantidad_huespedes" INTEGER NOT NULL,
    "tipo_habitacion_preferido_id" UUID,
    "comentario_huesped" VARCHAR(1000),
    "notas_operativas" VARCHAR(2000),
    "responsable_id" UUID,
    "creado_por_id" UUID,
    "confirmada_en" TIMESTAMPTZ(6),
    "cancelada_en" TIMESTAMPTZ(6),
    "motivo_cancelacion" VARCHAR(500),
    "clave_idempotencia" VARCHAR(160),
    "huella_solicitud" CHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID,
    "accion" VARCHAR(60) NOT NULL,
    "entidad" VARCHAR(40) NOT NULL,
    "entidad_id" UUID NOT NULL,
    "datos" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "limites_tasa" (
    "clave" VARCHAR(300) NOT NULL,
    "hits" INTEGER NOT NULL,
    "reinicio" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "limites_tasa_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_codigo_key" ON "roles"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "permisos_codigo_key" ON "permisos"("codigo");

-- CreateIndex
CREATE INDEX "rol_permisos_permiso_id_idx" ON "rol_permisos"("permiso_id");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_habitacion_nombre_key" ON "tipos_habitacion"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "canales_codigo_key" ON "canales"("codigo");

-- CreateIndex
CREATE INDEX "ajustes_actualizado_por_id_idx" ON "ajustes"("actualizado_por_id");

-- CreateIndex
CREATE INDEX "habitaciones_tipo_habitacion_id_idx" ON "habitaciones"("tipo_habitacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "habitaciones_numero_activa_key" ON "habitaciones"("numero") WHERE ("activa" = true);

-- CreateIndex
CREATE INDEX "camas_habitacion_id_idx" ON "camas"("habitacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "camas_habitacion_identificador_activa_key" ON "camas"("habitacion_id", "identificador") WHERE ("activa" = true);

-- CreateIndex
CREATE INDEX "bloqueos_habitacion_id_fecha_inicio_idx" ON "bloqueos"("habitacion_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "bloqueos_cama_id_idx" ON "bloqueos"("cama_id");

-- CreateIndex
CREATE INDEX "bloqueos_creado_por_id_idx" ON "bloqueos"("creado_por_id");

-- CreateIndex
CREATE INDEX "bloqueos_liberado_por_id_idx" ON "bloqueos"("liberado_por_id");

-- CreateIndex
CREATE INDEX "ocupaciones_cama_cama_id_fecha_inicio_idx" ON "ocupaciones_cama"("cama_id", "fecha_inicio");

-- CreateIndex
CREATE INDEX "ocupaciones_cama_reserva_id_idx" ON "ocupaciones_cama"("reserva_id");

-- CreateIndex
CREATE INDEX "ocupaciones_cama_bloqueo_id_idx" ON "ocupaciones_cama"("bloqueo_id");

-- CreateIndex
CREATE INDEX "huespedes_telefono_idx" ON "huespedes"("telefono");

-- CreateIndex
CREATE INDEX "huespedes_apellidos_nombres_idx" ON "huespedes"("apellidos", "nombres");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_numero_key" ON "reservas"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_clave_idempotencia_key" ON "reservas"("clave_idempotencia");

-- CreateIndex
CREATE INDEX "reservas_estado_fecha_entrada_idx" ON "reservas"("estado", "fecha_entrada");

-- CreateIndex
CREATE INDEX "reservas_fecha_entrada_fecha_salida_idx" ON "reservas"("fecha_entrada", "fecha_salida");

-- CreateIndex
CREATE INDEX "reservas_huesped_id_idx" ON "reservas"("huesped_id");

-- CreateIndex
CREATE INDEX "reservas_canal_id_idx" ON "reservas"("canal_id");

-- CreateIndex
CREATE INDEX "reservas_tipo_habitacion_preferido_id_idx" ON "reservas"("tipo_habitacion_preferido_id");

-- CreateIndex
CREATE INDEX "reservas_responsable_id_idx" ON "reservas"("responsable_id");

-- CreateIndex
CREATE INDEX "reservas_creado_por_id_idx" ON "reservas"("creado_por_id");

-- CreateIndex
CREATE INDEX "reservas_created_at_idx" ON "reservas"("created_at");

-- CreateIndex
CREATE INDEX "auditoria_entidad_entidad_id_created_at_idx" ON "auditoria"("entidad", "entidad_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_created_at_idx" ON "auditoria"("created_at");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_permisos" ADD CONSTRAINT "rol_permisos_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_actualizado_por_id_fkey" FOREIGN KEY ("actualizado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitaciones" ADD CONSTRAINT "habitaciones_tipo_habitacion_id_fkey" FOREIGN KEY ("tipo_habitacion_id") REFERENCES "tipos_habitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camas" ADD CONSTRAINT "camas_habitacion_id_fkey" FOREIGN KEY ("habitacion_id") REFERENCES "habitaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_habitacion_id_fkey" FOREIGN KEY ("habitacion_id") REFERENCES "habitaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_cama_id_fkey" FOREIGN KEY ("cama_id") REFERENCES "camas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_liberado_por_id_fkey" FOREIGN KEY ("liberado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_cama_id_fkey" FOREIGN KEY ("cama_id") REFERENCES "camas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_bloqueo_id_fkey" FOREIGN KEY ("bloqueo_id") REFERENCES "bloqueos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_canal_id_fkey" FOREIGN KEY ("canal_id") REFERENCES "canales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_huesped_id_fkey" FOREIGN KEY ("huesped_id") REFERENCES "huespedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_tipo_habitacion_preferido_id_fkey" FOREIGN KEY ("tipo_habitacion_preferido_id") REFERENCES "tipos_habitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Restricciones que Prisma no expresa (escritas a mano)
-- ============================================================

-- Necesaria para combinar "=" (uuid) y "&&" (rangos) en una restricción de exclusión
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Usuarios: email siempre en minúsculas
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_email_minusculas" CHECK ("email" = lower("email"));

-- Catálogos
ALTER TABLE "tipos_habitacion" ADD CONSTRAINT "tipos_habitacion_capacidad_valida"
  CHECK ("capacidad_sugerida" IS NULL OR "capacidad_sugerida" BETWEEN 1 AND 50);
ALTER TABLE "canales" ADD CONSTRAINT "canales_codigo_formato" CHECK ("codigo" ~ '^[a-z0-9_]{2,30}$');
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_publicado_requiere_confirmado" CHECK (NOT "publicado" OR "confirmado");

-- Habitaciones y camas
ALTER TABLE "habitaciones" ADD CONSTRAINT "habitaciones_capacidad_valida" CHECK ("capacidad" BETWEEN 1 AND 50);
ALTER TABLE "habitaciones" ADD CONSTRAINT "habitaciones_numero_no_vacio" CHECK (length(btrim("numero")) > 0);
ALTER TABLE "camas" ADD CONSTRAINT "camas_plazas_validas" CHECK ("plazas" BETWEEN 1 AND 4);
ALTER TABLE "camas" ADD CONSTRAINT "camas_identificador_no_vacio" CHECK (length(btrim("identificador")) > 0);

-- Bloqueos: fecha de fin exclusiva y posterior al inicio; la liberación registra quién y cuándo
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_fechas_validas"
  CHECK ("fecha_fin" IS NULL OR "fecha_fin" > "fecha_inicio");
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_liberacion_coherente"
  CHECK (("liberado_en" IS NULL) = ("liberado_por_id" IS NULL));
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_motivo_no_vacio" CHECK (length(btrim("motivo")) > 0);

-- Ocupaciones: exactamente un origen (reserva o bloqueo) según el tipo
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_origen_coherente" CHECK (
  ("tipo" = 'RESERVA' AND "reserva_id" IS NOT NULL AND "bloqueo_id" IS NULL AND "fecha_fin" IS NOT NULL)
  OR ("tipo" = 'BLOQUEO' AND "bloqueo_id" IS NOT NULL AND "reserva_id" IS NULL)
);
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_fechas_validas"
  CHECK ("fecha_fin" IS NULL OR "fecha_fin" > "fecha_inicio");
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_liberacion_coherente"
  CHECK ("activa" = ("liberada_en" IS NULL));

-- REGLA CENTRAL CONTRA LA SOBREVENTA: una cama no puede tener dos ocupaciones ACTIVAS cuyas noches
-- se crucen. Rango [fecha_inicio, fecha_fin): la salida de una reserva puede ser la entrada de otra.
-- fecha_fin NULL = sin fin (bloqueo indefinido). PostgreSQL la valida dentro de cada transacción,
-- también con solicitudes simultáneas (la segunda falla con SQLSTATE 23P01).
ALTER TABLE "ocupaciones_cama" ADD CONSTRAINT "ocupaciones_cama_sin_cruce"
  EXCLUDE USING gist ("cama_id" WITH =, daterange("fecha_inicio", "fecha_fin", '[)') WITH &&)
  WHERE ("activa");

-- Huéspedes
ALTER TABLE "huespedes" ADD CONSTRAINT "huespedes_documento_coherente"
  CHECK (("tipo_documento" IS NULL) = ("numero_documento" IS NULL));
ALTER TABLE "huespedes" ADD CONSTRAINT "huespedes_email_minusculas" CHECK ("email" IS NULL OR "email" = lower("email"));

-- Reservas
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_fechas_validas" CHECK ("fecha_salida" > "fecha_entrada");
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_estancia_maxima" CHECK ("fecha_salida" - "fecha_entrada" <= 365);
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cantidad_huespedes_valida" CHECK ("cantidad_huespedes" BETWEEN 1 AND 200);
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cancelacion_coherente"
  CHECK (("estado" = 'CANCELADA') = ("cancelada_en" IS NOT NULL));
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_idempotencia_coherente"
  CHECK (("clave_idempotencia" IS NULL) = ("huella_solicitud" IS NULL));

-- Búsqueda de reservas por código ("HR-00042") y de huéspedes por nombre sin distinguir mayúsculas
CREATE INDEX "huespedes_nombre_completo_idx" ON "huespedes" (lower("nombres" || ' ' || "apellidos"));

-- Auditoría inmutable: no se permite modificar ni borrar registros
CREATE FUNCTION "auditoria_inmutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La auditoría es inmutable' USING ERRCODE = 'restrict_violation';
END;
$$;
CREATE TRIGGER "auditoria_sin_cambios" BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION "auditoria_inmutable"();
