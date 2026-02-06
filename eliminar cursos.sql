-- =====================================================
-- MIGRACIÓN: ELIMINAR CURSOS
-- Sistema Repositorio Académico v3.0
-- De: Promoción → Curso → Especialidad
-- A: Promoción + Especialidad (directo)
-- =====================================================

-- IMPORTANTE: Hacer backup antes de ejecutar
-- mysql -u root -p nombre_bd > backup_$(date +%Y%m%d_%H%M%S).sql

-- =====================================================
-- PASO 1: Agregar columnas promocion_id y especialidad_id a proyectos
-- =====================================================

ALTER TABLE proyectos 
ADD COLUMN promocion_id INT NULL AFTER tutor_id;

ALTER TABLE proyectos 
ADD COLUMN especialidad_id INT NULL AFTER promocion_id;

-- =====================================================
-- PASO 2: Migrar datos existentes desde cursos
-- =====================================================

-- Copiar promocion_id y especialidad_id desde la tabla cursos
UPDATE proyectos p
JOIN cursos c ON c.id = p.curso_id
SET 
  p.promocion_id = c.promocion_id,
  p.especialidad_id = c.especialidad_id
WHERE p.curso_id IS NOT NULL;

-- =====================================================
-- PASO 3: Verificación de migración
-- =====================================================

-- Ver cuántos proyectos se migraron correctamente
SELECT 
  COUNT(*) as total_proyectos,
  COUNT(promocion_id) as con_promocion,
  COUNT(especialidad_id) as con_especialidad,
  COUNT(*) - COUNT(promocion_id) as sin_promocion
FROM proyectos
WHERE eliminado = 0;

-- Si hay proyectos sin promoción, asignarles una por defecto
-- (Ejecutar solo si es necesario)
/*
UPDATE proyectos 
SET promocion_id = (SELECT id FROM promociones ORDER BY anio DESC LIMIT 1)
WHERE promocion_id IS NULL;

UPDATE proyectos 
SET especialidad_id = (SELECT id FROM especialidades LIMIT 1)
WHERE especialidad_id IS NULL;
*/

-- =====================================================
-- PASO 4: Hacer columnas obligatorias
-- =====================================================

ALTER TABLE proyectos 
MODIFY COLUMN promocion_id INT NOT NULL;

ALTER TABLE proyectos 
MODIFY COLUMN especialidad_id INT NOT NULL;

-- =====================================================
-- PASO 5: Agregar foreign keys
-- =====================================================

ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_promocion 
FOREIGN KEY (promocion_id) REFERENCES promociones(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_especialidad 
FOREIGN KEY (especialidad_id) REFERENCES especialidades(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Re-agregar foreign key de tutor (por si se perdió)
-- Si da error de duplicado, ignorar
ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_tutor 
FOREIGN KEY (tutor_id) REFERENCES usuarios(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- =====================================================
-- PASO 6: Eliminar relación con curso
-- =====================================================

-- Eliminar foreign key de curso
ALTER TABLE proyectos 
DROP FOREIGN KEY proyectos_ibfk_2;

-- Eliminar columna curso_id
ALTER TABLE proyectos 
DROP COLUMN curso_id;

-- =====================================================
-- PASO 7: Actualizar constraint único
-- =====================================================

-- Eliminar constraint antiguo
ALTER TABLE proyectos 
DROP KEY uq_proyecto_titulo_curso;

-- Agregar nuevo constraint (título único por promoción y especialidad)
ALTER TABLE proyectos 
ADD UNIQUE KEY uq_proyecto_titulo_promocion_especialidad 
(titulo, promocion_id, especialidad_id);

-- =====================================================
-- PASO 8: Eliminar tabla tutor_curso
-- =====================================================

-- Los tutores ahora pueden ver todas las promociones/especialidades
DROP TABLE IF EXISTS tutor_curso;

-- =====================================================
-- PASO 9: (OPCIONAL) Mantener o eliminar tabla cursos
-- =====================================================

-- OPCIÓN A: Mantener la tabla cursos por si acaso
-- (No hacer nada, dejar la tabla)

-- OPCIÓN B: Eliminar la tabla cursos completamente
-- (Descomenta la siguiente línea si quieres eliminarla)
-- DROP TABLE IF EXISTS cursos;

-- =====================================================
-- VERIFICACIONES POST-MIGRACIÓN
-- =====================================================

-- 1. Verificar estructura de proyectos
DESCRIBE proyectos;
-- DEBE tener: promocion_id, especialidad_id, tutor_id
-- NO debe tener: curso_id

-- 2. Ver proyectos actuales con nueva estructura
SELECT 
  p.id,
  p.titulo AS proyecto,
  pr.anio AS promocion,
  e.nombre AS especialidad,
  u.nombre AS tutor,
  p.estado,
  IF(af.id IS NOT NULL, 'Sí', 'No') AS tiene_memoria
FROM proyectos p
JOIN promociones pr ON pr.id = p.promocion_id
JOIN especialidades e ON e.id = p.especialidad_id
JOIN usuarios u ON u.id = p.tutor_id
LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
WHERE p.eliminado = 0
ORDER BY pr.anio DESC, e.nombre, p.titulo
LIMIT 20;

-- 3. Contar proyectos por promoción y especialidad
SELECT 
  pr.anio AS promocion,
  e.nombre AS especialidad,
  COUNT(p.id) AS total_proyectos,
  COUNT(af.id) AS con_memoria_tecnica
FROM proyectos p
JOIN promociones pr ON pr.id = p.promocion_id
JOIN especialidades e ON e.id = p.especialidad_id
LEFT JOIN archivo_final af ON af.proyecto_id = p.id AND af.eliminado = 0
WHERE p.eliminado = 0
GROUP BY pr.anio, e.nombre
ORDER BY pr.anio DESC, e.nombre;

-- 4. Verificar que tutor_curso fue eliminada
SHOW TABLES LIKE 'tutor_curso';
-- No debe mostrar ningún resultado

-- 5. Verificar foreign keys de proyectos
SELECT 
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'proyectos' 
  AND TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL;
-- Debe mostrar: fk_proyectos_promocion, fk_proyectos_especialidad, fk_proyectos_tutor

-- 6. Verificar unique keys
SHOW INDEX FROM proyectos WHERE Key_name LIKE 'uq_%';
-- Debe mostrar: uq_proyecto_titulo_promocion_especialidad

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =====================================================

-- Crear un proyecto de prueba con la nueva estructura
/*
INSERT INTO proyectos (tutor_id, promocion_id, especialidad_id, titulo, descripcion)
VALUES (
  (SELECT id FROM usuarios WHERE rol = 'tutor' LIMIT 1),
  (SELECT id FROM promociones ORDER BY anio DESC LIMIT 1),
  (SELECT id FROM especialidades LIMIT 1),
  'Sistema de Gestión Académica',
  'Proyecto de prueba con nueva estructura'
);

-- Ver el proyecto creado
SELECT 
  p.titulo,
  pr.anio AS promocion,
  e.nombre AS especialidad,
  u.nombre AS tutor
FROM proyectos p
JOIN promociones pr ON pr.id = p.promocion_id
JOIN especialidades e ON e.id = p.especialidad_id
JOIN usuarios u ON u.id = p.tutor_id
WHERE p.id = LAST_INSERT_ID();
*/

-- =====================================================
-- RESUMEN DE CAMBIOS
-- =====================================================

/*
CAMBIOS APLICADOS:
✅ Agregadas columnas promocion_id y especialidad_id a proyectos
✅ Migrados datos desde cursos
✅ Eliminada columna curso_id de proyectos
✅ Eliminada tabla tutor_curso
✅ Actualizado constraint único de proyectos
✅ Agregados foreign keys de promocion y especialidad

ESTRUCTURA NUEVA:
proyectos
├── tutor_id → usuarios
├── promocion_id → promociones
├── especialidad_id → especialidades
├── titulo (único por promoción + especialidad)
└── ...otros campos

FLUJO NUEVO:
Tutor → Selecciona Promoción → Selecciona Especialidad → Ve proyectos
*/

-- =====================================================
-- FIN DEL SCRIPT
-- =====================================================
