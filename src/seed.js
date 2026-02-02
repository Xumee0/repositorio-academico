const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function seed(){
  console.log('🌱 Ejecutando seed institucional...');

  const password = await bcrypt.hash('123456', 10);

  // Limpiar tablas (orden correcto)
  await db.query('DELETE FROM notas');
  await db.query('DELETE FROM archivo_final');
  await db.query('DELETE FROM proyectos');
  await db.query('DELETE FROM docente_curso');
  await db.query('DELETE FROM estudiante_curso');
  await db.query('DELETE FROM usuarios');
  await db.query('DELETE FROM cursos');
  await db.query('DELETE FROM promociones');
  await db.query('DELETE FROM especialidades');

  // ESPECIALIDADES
  const [rInf] = await db.query(`INSERT INTO especialidades(nombre) VALUES ('Informatica')`);
  const infId = rInf.insertId;

  const [rCont] = await db.query(`INSERT INTO especialidades(nombre) VALUES ('Contabilidad')`);
  const contId = rCont.insertId;

  // PROMOCIÓN
  const [rPromo] = await db.query(`INSERT INTO promociones(anio, descripcion) VALUES (2026, 'Promoción 2026')`);
  const promoId = rPromo.insertId;

  // CURSOS
  const [rC1] = await db.query(
    `INSERT INTO cursos(nombre, paralelo, promocion_id, especialidad_id) VALUES ('3ro','A',?,?)`,
    [promoId, infId]
  );
  const c3AInf = rC1.insertId;

  const [rC2] = await db.query(
    `INSERT INTO cursos(nombre, paralelo, promocion_id, especialidad_id) VALUES ('3ro','B',?,?)`,
    [promoId, infId]
  );
  const c3BInf = rC2.insertId;

  const [rC3] = await db.query(
    `INSERT INTO cursos(nombre, paralelo, promocion_id, especialidad_id) VALUES ('3ro','A',?,?)`,
    [promoId, contId]
  );
  const c3ACont = rC3.insertId;

  const [rC4] = await db.query(
    `INSERT INTO cursos(nombre, paralelo, promocion_id, especialidad_id) VALUES ('3ro','B',?,?)`,
    [promoId, contId]
  );
  const c3BCont = rC4.insertId;

  // Helper insertar usuario
  async function createUser(nombre, correo, rol){
    const [r] = await db.query(
      `INSERT INTO usuarios(nombre, correo, password, rol) VALUES (?,?,?,?)`,
      [nombre, correo, password, rol]
    );
    return r.insertId;
  }

  // USUARIOS
  await createUser('Administrador', 'admin@colegio.com', 'admin');
  await createUser('Secretaría', 'secretaria@colegio.com', 'secretaria');

  const profInf = await createUser('Docente Informática', 'profe.informatica@colegio.com', 'docente');
  const profCont = await createUser('Docente Contabilidad', 'profe.contabilidad@colegio.com', 'docente');

  const e1 = await createUser('Alumno 3ro A Inf', 'alumno.3roa.inf@colegio.com', 'estudiante');
  const e2 = await createUser('Alumno 3ro B Inf', 'alumno.3rob.inf@colegio.com', 'estudiante');
  const e3 = await createUser('Alumno 3ro A Cont', 'alumno.3roa.cont@colegio.com', 'estudiante');
  const e4 = await createUser('Alumno 3ro B Cont', 'alumno.3rob.cont@colegio.com', 'estudiante');

  // ASIGNAR DOCENTES A CURSOS
  await db.query(`INSERT INTO docente_curso(docente_id, curso_id) VALUES (?,?)`, [profInf, c3AInf]);
  await db.query(`INSERT INTO docente_curso(docente_id, curso_id) VALUES (?,?)`, [profInf, c3BInf]);
  await db.query(`INSERT INTO docente_curso(docente_id, curso_id) VALUES (?,?)`, [profCont, c3ACont]);
  await db.query(`INSERT INTO docente_curso(docente_id, curso_id) VALUES (?,?)`, [profCont, c3BCont]);

  // ASIGNAR ESTUDIANTES A CURSOS
  await db.query(`INSERT INTO estudiante_curso(estudiante_id, curso_id) VALUES (?,?)`, [e1, c3AInf]);
  await db.query(`INSERT INTO estudiante_curso(estudiante_id, curso_id) VALUES (?,?)`, [e2, c3BInf]);
  await db.query(`INSERT INTO estudiante_curso(estudiante_id, curso_id) VALUES (?,?)`, [e3, c3ACont]);
  await db.query(`INSERT INTO estudiante_curso(estudiante_id, curso_id) VALUES (?,?)`, [e4, c3BCont]);

  // PROYECTOS (1 por estudiante)
  await db.query(
    `INSERT INTO proyectos(estudiante_id, curso_id, titulo, descripcion, estado) VALUES (?,?,?,?,?)`,
    [e1, c3AInf, 'Proyecto Final IA', 'Proyecto de 3ro A Informática', 'en_proceso']
  );
  await db.query(
    `INSERT INTO proyectos(estudiante_id, curso_id, titulo, descripcion, estado) VALUES (?,?,?,?,?)`,
    [e2, c3BInf, 'Proyecto Final IB', 'Proyecto de 3ro B Informática', 'en_proceso']
  );
  await db.query(
    `INSERT INTO proyectos(estudiante_id, curso_id, titulo, descripcion, estado) VALUES (?,?,?,?,?)`,
    [e3, c3ACont, 'Proyecto Final CA', 'Proyecto de 3ro A Contabilidad', 'en_proceso']
  );
  await db.query(
    `INSERT INTO proyectos(estudiante_id, curso_id, titulo, descripcion, estado) VALUES (?,?,?,?,?)`,
    [e4, c3BCont, 'Proyecto Final CB', 'Proyecto de 3ro B Contabilidad', 'en_proceso']
  );

  console.log('✅ Seed completo');
  console.log('Password para todos: 123456');
  console.log('Admin: admin@colegio.com');
  console.log('Secretaría: secretaria@colegio.com');
  console.log('Docente Inf: profe.informatica@colegio.com');
  console.log('Docente Cont: profe.contabilidad@colegio.com');
  console.log('Estudiantes:');
  console.log('- alumno.3roa.inf@colegio.com');
  console.log('- alumno.3rob.inf@colegio.com');
  console.log('- alumno.3roa.cont@colegio.com');
  console.log('- alumno.3rob.cont@colegio.com');

  process.exit(0);
}

seed().catch(err=>{
  console.error('❌ Seed error:', err);
  process.exit(1);
});
