-- =====================================================
-- SCRIPT DE MIGRACIÓN COMPLETA
-- Sistema Repositorio Académico v2.0
-- De: Estudiantes suben proyectos
-- A: Tutores suben memorias técnicas (sin estudiantes)
-- =====================================================

-- IMPORTANTE: Hacer backup de la base de datos antes de ejecutar
-- mysql -u root -p nombre_bd > backup_$(date +%Y%m%d_%H%M%S).sql

-- =====================================================
-- PASO 1: Modificar roles de usuarios
-- =====================================================

-- Cambiar 'docente' por 'tutor'
UPDATE usuarios SET rol = 'tutor' WHERE rol = 'docente';

-- Consolidar admin y secretaria en 'admin'
UPDATE usuarios SET rol = 'admin' WHERE rol IN ('admin', 'secretaria');

-- Actualizar enum de roles (solo admin y tutor)
ALTER TABLE usuarios 
MODIFY COLUMN rol ENUM('admin','tutor') NOT NULL;


-- =====================================================
-- PASO 2: Renombrar tabla docente_curso a tutor_curso
-- =====================================================

RENAME TABLE docente_curso TO tutor_curso;

-- Cambiar nombre de columna
ALTER TABLE tutor_curso 
CHANGE docente_id tutor_id INT NOT NULL;

-- Actualizar constraint único
ALTER TABLE tutor_curso DROP KEY uq_docente_curso;
ALTER TABLE tutor_curso 
ADD UNIQUE KEY uq_tutor_curso (tutor_id, curso_id);

-- =====================================================
-- PASO 3: Modificar tabla proyectos
-- =====================================================

-- Agregar columna tutor_id (quien creó/gestiona el proyecto)
ALTER TABLE proyectos 
ADD COLUMN tutor_id INT NULL AFTER curso_id;

-- Asignar tutores a proyectos existentes
-- Estrategia: Asignar el primer tutor del curso
UPDATE proyectos p
SET p.tutor_id = (
  SELECT tc.tutor_id 
  FROM tutor_curso tc 
  WHERE tc.curso_id = p.curso_id 
  LIMIT 1
)
WHERE p.tutor_id IS NULL;

-- Si hay proyectos sin tutor asignado, asignar un admin/tutor por defecto
UPDATE proyectos p
SET p.tutor_id = (
  SELECT id FROM usuarios 
  WHERE rol IN ('admin', 'tutor') 
  LIMIT 1
)
WHERE p.tutor_id IS NULL;

-- Hacer tutor_id obligatorio
ALTER TABLE proyectos 
MODIFY COLUMN tutor_id INT NOT NULL;

-- Agregar foreign key
ALTER TABLE proyectos 
ADD CONSTRAINT fk_proyectos_tutor 
FOREIGN KEY (tutor_id) REFERENCES usuarios(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Eliminar relación con estudiante
ALTER TABLE proyectos 
DROP FOREIGN KEY proyectos_ibfk_1;

ALTER TABLE proyectos 
DROP COLUMN estudiante_id;

-- Actualizar constraint único
-- Ahora: un título único por curso (no por estudiante)
ALTER TABLE proyectos 
DROP KEY uq_proyecto_estudiante_curso;

ALTER TABLE proyectos 
ADD UNIQUE KEY uq_proyecto_titulo_curso (titulo, curso_id);

-- =====================================================
-- PASO 4: Modificar tabla notas
-- =====================================================

-- Eliminar foreign key antigua
ALTER TABLE notas 
DROP FOREIGN KEY notas_ibfk_2;

-- Renombrar columna
ALTER TABLE notas 
CHANGE docente_id tutor_id INT NOT NULL;

-- Agregar nueva foreign key
ALTER TABLE notas 
ADD CONSTRAINT fk_notas_tutor 
FOREIGN KEY (tutor_id) REFERENCES usuarios(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Actualizar constraint único
ALTER TABLE notas 
DROP KEY uq_nota_docente_proyecto;

ALTER TABLE notas 
ADD UNIQUE KEY uq_nota_tutor_proyecto (proyecto_id, tutor_id);

-- =====================================================
-- PASO 5: Eliminar tabla estudiante_curso
-- =====================================================

-- Esta tabla ya no es necesaria
DROP TABLE IF EXISTS estudiante_curso;

-- =====================================================
-- PASO 6: Limpiar usuarios que eran estudiantes
-- =====================================================

-- OPCIONAL Y PELIGROSO: Solo ejecutar si estás seguro
-- Esto eliminará permanentemente los registros de estudiantes
-- ADVERTENCIA: Los proyectos ya no estarán vinculados a estos usuarios

-- Para ver cuántos estudiantes hay:
SELECT COUNT(*) as total_estudiantes 
FROM usuarios 
WHERE rol NOT IN ('admin', 'tutor');

-- Para eliminarlos (DESCOMENTAR SOLO SI ESTÁS SEGURO):
-- DELETE FROM usuarios WHERE rol NOT IN ('admin', 'tutor');

-- =====================================================
-- PASO 7: Actualizar bitácora (opcional)
-- =====================================================

-- Si quieres mantener consistencia en la bitácora
UPDATE bitacora 
SET accion = REPLACE(accion, 'docente', 'tutor')
WHERE accion LIKE '%docente%';

-- =====================================================
-- VERIFICACIONES POST-MIGRACIÓN
-- =====================================================

-- Verificar que todos los proyectos tienen tutor
SELECT COUNT(*) as proyectos_sin_tutor 
FROM proyectos 
WHERE tutor_id IS NULL;
-- Debe ser 0

-- Verificar que no hay roles inválidos
SELECT DISTINCT rol FROM usuarios;
-- Solo debe mostrar: admin, tutor

-- Verificar integridad de tutor_curso
SELECT 
  tc.id,
  tc.tutor_id,
  u.nombre,
  tc.curso_id,
  c.nombre as curso
FROM tutor_curso tc
JOIN usuarios u ON u.id = tc.tutor_id
JOIN cursos c ON c.id = tc.curso_id;

-- Verificar proyectos
SELECT 
  p.id,
  p.titulo,
  u.nombre as tutor,
  c.nombre as curso,
  e.nombre as especialidad
FROM proyectos p
JOIN usuarios u ON u.id = p.tutor_id
JOIN cursos c ON c.id = p.curso_id
JOIN especialidades e ON e.id = c.especialidad_id
LIMIT 10;

-- =====================================================
-- DATOS DE PRUEBA (OPCIONAL)
-- =====================================================

-- Si quieres agregar datos de prueba después de la migración:

/*
-- Crear un tutor de prueba
INSERT INTO usuarios (nombre, correo, password, rol) 
VALUES ('María García', 'maria.garcia@colegio.com', 'hash_aqui', 'tutor');

-- Asignar tutor a un curso
INSERT INTO tutor_curso (tutor_id, curso_id)
VALUES (LAST_INSERT_ID(), 1);

-- Crear un proyecto de prueba
INSERT INTO proyectos (curso_id, tutor_id, titulo, descripcion)
VALUES (
  1, 
  LAST_INSERT_ID(), 
  'Sistema de Gestión de Biblioteca',
  'Sistema web para gestionar préstamos de libros'
);
*/

-- =====================================================
-- FIN DEL SCRIPT DE MIGRACIÓN
-- =====================================================

-- NOTAS IMPORTANTES:
-- 1. Este script modifica la estructura de la base de datos
-- 2. Algunos cambios son irreversibles
-- 3. SIEMPRE hacer backup antes de ejecutar
-- 4. Probar primero en un ambiente de desarrollo
-- 5. Revisar los datos después de la migración
