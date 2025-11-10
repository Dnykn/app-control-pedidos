import { db } from './firebase.js';
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, deleteDoc, addDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { authGuard, setupLogoutButton } from './auth.js';

// --- FUNCIÓN PARA CARGAR LOS PEDIDOS DE UNA EMPRESA ESPECÍFICA ---
async function cargarPedidos(empresaId) {
  const tablaPedidos = document.getElementById("tabla-pedidos");
  if (!tablaPedidos) return;

  // Mostramos un indicador de carga
  tablaPedidos.innerHTML = `<tr><td colspan="5">Cargando pedidos...</td></tr>`;

  try {
    // La consulta mágica: pedimos solo los pedidos que coincidan con el empresaId
    const pedidosRef = collection(db, "pedidos");
    const q = query(pedidosRef, where("empresaId", "==", empresaId));
    
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      tablaPedidos.innerHTML = `<tr><td colspan="5">No hay pedidos registrados. ¡Añade uno nuevo!</td></tr>`;
      return;
    }

    tablaPedidos.innerHTML = ""; // Limpiamos la tabla
    querySnapshot.forEach((docSnap) => {
      const pedido = docSnap.data();
      const idPedido = docSnap.id;

      // Fecha: puede no existir o ser un Timestamp (guardamos el Date completo)
      let fechaEntrega = null;
      let fechaEntregaStr = '—';
      if (pedido.fechaEntrega && typeof pedido.fechaEntrega.toDate === 'function') {
        fechaEntrega = pedido.fechaEntrega.toDate();
        fechaEntregaStr = fechaEntrega.toLocaleString();
      }

      // Badge según estado
      const getBadgeClass = (estado) => {
        if (!estado) return 'bg-secondary';
        const e = estado.toString().toLowerCase();
        if (e.includes('entreg')) return 'bg-success';
        if (e.includes('proceso') || e.includes('proceso')) return 'bg-warning text-dark';
        if (e.includes('pend')) return 'bg-secondary';
        return 'bg-secondary';
      };

      // --- Inicio del bloque a reemplazar ---

      const fila = document.createElement('tr');
      fila.setAttribute('data-id', idPedido);

      // Creamos una única celda que ocupará todo el ancho
      const celdaContenedora = document.createElement('td');
      celdaContenedora.colSpan = 5; // Ocupa las 5 columnas
      celdaContenedora.classList.add('p-0'); // Sin padding

      // Wrapper principal para las dos capas
      const wrapper = document.createElement('div');
      wrapper.className = 'order-row-wrapper';

      // Capa INFERIOR: Las acciones
      const actions = document.createElement('div');
      actions.className = 'order-actions-background';
      actions.innerHTML = `
        <button class="btn btn-sm btn-icon" data-action="en-proceso" title="Marcar en proceso"><i class="fa-solid fa-spinner"></i></button>
        <button class="btn btn-sm btn-icon" data-action="pendiente" title="Marcar pendiente"><i class="fa-solid fa-clock"></i></button>
        <button class="btn btn-sm btn-icon" data-action="entregado" title="Marcar entregado"><i class="fa-solid fa-check-circle"></i></button>
        <button class="btn btn-sm btn-icon text-danger" data-action="eliminar" title="Eliminar pedido"><i class="fa-solid fa-trash"></i></button>
      `;

      // Capa SUPERIOR: El contenido
      const content = document.createElement('div');
      content.className = 'order-content';
      // Guardamos la fecha completa en data- para que otras funciones la lean
      if (fechaEntrega) content.dataset.fecha = fechaEntrega.toISOString();
      content.innerHTML = `
        <div class="order-cell"><strong>${pedido.cliente || '—'}</strong></div>
        <div class="order-cell">${pedido.descripcion || '—'}</div>
        <div class="order-cell date-cell">${fechaEntregaStr}</div>
        <div class="order-cell"><span class="badge ${getBadgeClass(pedido.estado)}">${pedido.estado || 'pendiente'}</span></div>
        <div class="order-cell text-end">
          <a href="pedido.html?id=${idPedido}" class="btn btn-sm btn-outline-secondary" title="Ver pedido"><i class="fa-solid fa-eye"></i></a>
        </div>
      `;

      // Montamos la estructura
      wrapper.appendChild(actions);
      wrapper.appendChild(content);
      celdaContenedora.appendChild(wrapper);
      fila.appendChild(celdaContenedora);

      // Añadimos los listeners (tu código de listeners no cambia)
      const botones = fila.querySelectorAll('button[data-action]');
      botones.forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const accion = btn.getAttribute('data-action');
          if (accion === 'eliminar') {
            await eliminarPedido(idPedido, fila);
            return;
          }
          const mapa = {'en-proceso': 'en proceso', 'pendiente': 'pendiente', 'entregado': 'entregado'};
          const nuevoEstado = mapa[accion];
          if (nuevoEstado) await cambiarEstado(idPedido, nuevoEstado, fila);
        });
      });

      // Aplicar clases de fecha y estado automático si corresponde
      (async () => {
        try {
          await applyDateAndAutoState(fila, pedido.estado, fechaEntrega);
        } catch (err) {
          console.error('Error al aplicar estado/fecha automática:', err);
        }
      })();

      tablaPedidos.appendChild(fila);

      // --- Fin del bloque a reemplazar ---
    });

  } catch (error) {
    console.error("Error al cargar los pedidos: ", error);
    tablaPedidos.innerHTML = `<tr><td colspan="5">Error al cargar los datos.</td></tr>`;
  }
}

// --- FUNCIÓN PARA CARGAR LOS CLIENTES Y SU SALDO ---
async function cargarClientes(empresaId) {
  const tablaClientes = document.getElementById("tabla-clientes");
  if (!tablaClientes) return;

  tablaClientes.innerHTML = `<tr><td colspan="4">Cargando clientes...</td></tr>`;

  try {
    const clientesRef = collection(db, "clientes");
    const q = query(clientesRef, where("empresaId", "==", empresaId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      tablaClientes.innerHTML = `<tr><td colspan="4">No hay clientes registrados.</td></tr>`;
      return;
    }

    tablaClientes.innerHTML = "";
    querySnapshot.forEach((docSnap) => {
      const cliente = docSnap.data();
      const idCliente = docSnap.id;
      const saldo = Number(cliente.saldoFiado) || 0;
      const claseSaldo = saldo > 0 ? 'text-danger fw-bold' : '';

      const fila = document.createElement('tr');
      fila.setAttribute('data-id-cliente', idCliente);

      const celdaContenedora = document.createElement('td');
      celdaContenedora.colSpan = 4;
      celdaContenedora.className = 'p-0';

      const wrapper = document.createElement('div');
      wrapper.className = 'order-row-wrapper';

      // Capa INFERIOR: El botón de eliminar
      const actions = document.createElement('div');
      actions.className = 'order-actions-background justify-content-end';
      actions.innerHTML = `
        <button class="btn btn-sm btn-icon text-danger" title="Eliminar Cliente">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;

      // Capa SUPERIOR: Los datos del cliente (usando Flexbox)
      const content = document.createElement('div');
      content.className = 'order-content';
      content.innerHTML = `
        <div class="flex-fill" style="flex-basis: 30%;"><strong>${cliente.nombre}</strong></div>
        <div class="flex-fill" style="flex-basis: 25%;">${cliente.telefono || 'N/A'}</div>
        <div class="flex-fill ${claseSaldo}" style="flex-basis: 25%;">${saldo.toFixed(2)}</div>
        <div class="flex-fill text-end" style="flex-basis: 20%;">
          <a href="cliente.html?id=${idCliente}" class="btn btn-sm btn-outline-secondary">Ver Estado de Cuenta</a>
        </div>
      `;

      // Montamos la estructura
      wrapper.appendChild(actions);
      wrapper.appendChild(content);
      celdaContenedora.appendChild(wrapper);
      fila.appendChild(celdaContenedora);

      // Listener para el botón de eliminar
      fila.querySelector('button').addEventListener('click', async () => {
        if (!confirm(`¿Estás seguro de que quieres eliminar a ${cliente.nombre}? Esta acción es irreversible y borrará todo su historial de fiado.`)) return;
        try {
          // AVISO: Borrar un cliente y todo su historial es una operación compleja.
          // Por ahora, borramos solo el documento del cliente.
          await deleteDoc(doc(db, "clientes", idCliente));
          fila.remove();
        } catch (error) {
          console.error("Error al eliminar cliente:", error);
          alert("No se pudo eliminar al cliente.");
        }
      });
      
      tablaClientes.appendChild(fila);
    });

  } catch (error) {
    console.error("Error al cargar los clientes:", error);
    tablaClientes.innerHTML = `<tr><td colspan="4">Error al cargar los datos.</td></tr>`;
  }
}

// --- HELPERS: actualización optimista y eliminación ---
const getBadgeClass = (estado) => {
  if (!estado) return 'bg-secondary';
  const e = estado.toString().toLowerCase();
  if (e.includes('entreg')) return 'bg-success';
  if (e.includes('proceso')) return 'bg-warning text-dark';
  if (e.includes('pend')) return 'bg-secondary';
  return 'bg-secondary';
};

// --- Helpers de fecha/colores/estado automático ---
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function computeDateClass(estado, due, now = new Date()) {
  if (!due) return '';
  const e = (estado || '').toString().toLowerCase();
  // If delivered, use green
  if (e.includes('entreg')) return 'text-success fw-bold';
  // Compare by date (ignore time)
  const msPerDay = 24 * 60 * 60 * 1000;
  const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysDiff = Math.ceil((dueMid - nowMid) / msPerDay);
  // If due date already passed (day before today) => red
  if (daysDiff < 0) return 'text-danger fw-bold';
  // If 2 days or less remaining (including today) => warning (orange)
  if (daysDiff <= 2) return 'text-warning fw-bold';
  return '';
}

async function applyDateAndAutoState(fila, estado, due) {
  const dateCell = fila.querySelector('.order-content > .order-cell.date-cell');
  const badge = fila.querySelector('.badge');
  const now = new Date();

  const dateClass = computeDateClass(estado, due, now);
  // limpiar clases previas relevantes
  if (dateCell) {
    dateCell.classList.remove('text-danger', 'fw-bold', 'text-warning', 'text-primary');
    if (dateClass) dateCell.classList.add(...dateClass.split(' '));
  }

  // Si ya pasó la fecha y la hora completa y no está entregado, forzar estado a 'pendiente'
  const estLower = (estado || '').toString().toLowerCase();
  // Only force once per row
  const autoFlag = fila.dataset.autoPendingApplied === 'true';
  // Compare by day only
  if (due) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysDiff = Math.ceil((dueMid - nowMid) / msPerDay);
    if (daysDiff < 0 && !estLower.includes('entreg') && !estLower.includes('pend') && !autoFlag) {
      try {
        const ref = doc(db, 'pedidos', fila.getAttribute('data-id'));
        await updateDoc(ref, { estado: 'pendiente' });
        // Actualizamos UI
        if (badge) {
          badge.textContent = 'pendiente';
          badge.className = `badge ${getBadgeClass('pendiente')}`;
        }
        fila.dataset.autoPendingApplied = 'true';
      } catch (err) {
        console.error('Error al forzar pendiente:', err);
      }
    }
  }
  // Start or stop timer for remaining time display
  if (due) {
    startRowTimer(fila, due);
  } else {
    stopRowTimer(fila);
  }
}

// --- Timer helpers: show time remaining or overdue, update classes and auto-pending once ---
function formatDiffDays(ms) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil(Math.abs(ms) / msPerDay);
  return `${days}`;
}

function startRowTimer(fila, due) {
  stopRowTimer(fila); // clear previous if any
  // If delivered, don't start
  const badge = fila.querySelector('.badge');
  const estado = badge ? badge.textContent.toString().toLowerCase() : '';
  if (estado.includes('entreg')) return;

  const tick = async () => {
    const now = new Date();
    const dateCell = fila.querySelector('.order-content > .order-cell.date-cell');
    if (!dateCell) return;
    const diff = due - now;
    if (diff >= 0) {
      // days remaining
      const days = formatDiffDays(diff);
      dateCell.textContent = days + (days === '1' ? ' día restante' : ' días restantes');
      // clear color classes
      dateCell.classList.remove('text-danger', 'fw-bold', 'text-primary', 'text-success', 'text-warning');
      // apply warning if 2 days or less
      const msPerDay = 24 * 60 * 60 * 1000;
      const dueMid = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const daysDiff = Math.ceil((dueMid - nowMid) / msPerDay);
      if (daysDiff <= 2) dateCell.classList.add('text-warning', 'fw-bold');
    } else {
      // overdue (by days)
      const days = formatDiffDays(diff);
      dateCell.textContent = 'Vencido: ' + days + (days === '1' ? ' día' : ' días');
      dateCell.classList.remove('text-warning', 'fw-bold', 'text-primary', 'text-success');
      dateCell.classList.add('text-danger', 'fw-bold');
      // if not delivered or pending, force pendiente once
      const badgeEl = fila.querySelector('.badge');
      const est = badgeEl ? badgeEl.textContent.toString().toLowerCase() : '';
      const autoFlag = fila.dataset.autoPendingApplied === 'true';
      if (!est.includes('entreg') && !est.includes('pend') && !autoFlag) {
        try {
          const ref = doc(db, 'pedidos', fila.getAttribute('data-id'));
          await updateDoc(ref, { estado: 'pendiente' });
          if (badgeEl) {
            badgeEl.textContent = 'pendiente';
            badgeEl.className = `badge ${getBadgeClass('pendiente')}`;
          }
          fila.dataset.autoPendingApplied = 'true';
        } catch (err) {
          console.error('Error al forzar pendiente en tick:', err);
        }
      }
    }
  };

  // initial tick then interval every 30s
  tick();
  const id = setInterval(tick, 30000);
  fila._timerId = id;
}

function stopRowTimer(fila) {
  if (fila._timerId) {
    clearInterval(fila._timerId);
    delete fila._timerId;
  }
}

async function cambiarEstado(idPedido, nuevoEstado, fila) {
  try {
    // UI optimista: actualizar badge inmediatamente
    const badge = fila.querySelector('.badge');
    const botones = fila.querySelectorAll('button[data-action]');
    // Guardamos estado previo
    const prevText = badge ? badge.textContent : '';
    const prevClass = badge ? badge.className : '';

    if (badge) {
      badge.textContent = nuevoEstado;
      badge.className = `badge ${getBadgeClass(nuevoEstado)}`;
    }
    // Deshabilitar botones mientras se actualiza
    botones.forEach(b => b.disabled = true);

    const ref = doc(db, 'pedidos', idPedido);
    await updateDoc(ref, { estado: nuevoEstado });

    // Reactivar botones
    botones.forEach(b => b.disabled = false);
    // Recalcular color de la fecha después del cambio (usamos la fecha almacenada en data-)
    try {
      const content = fila.querySelector('.order-content');
      const fechaIso = content ? content.dataset.fecha : null;
      const due = fechaIso ? new Date(fechaIso) : null;
      await applyDateAndAutoState(fila, nuevoEstado, due);
    } catch (err) {
      console.error('Error recalculando color de fecha después de cambiar estado:', err);
    }
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    // Revertir UI si algo falla
    const badge = fila.querySelector('.badge');
    if (badge) {
      // intentar recuperar estado desde la base (no ideal, pero al menos revertimos visualmente)
      // dejamos un texto genérico
      badge.textContent = 'error';
      badge.className = 'badge bg-danger';
    }
    const botones = fila.querySelectorAll('button[data-action]');
    botones.forEach(b => b.disabled = false);
    alert('No se pudo actualizar el estado. Revisa la consola para más detalles.');
  }
}

async function eliminarPedido(idPedido, fila) {
  const confirmar = confirm('¿Seguro que deseas eliminar este pedido? Esta acción no se puede deshacer.');
  if (!confirmar) return;
  try {
    // Deshabilitar botones localmente
    const botones = fila.querySelectorAll('button[data-action]');
    botones.forEach(b => b.disabled = true);

    const ref = doc(db, 'pedidos', idPedido);
    await deleteDoc(ref);

    // Remover fila de la tabla
    fila.remove();
  } catch (error) {
    console.error('Error al eliminar pedido:', error);
    const botones = fila.querySelectorAll('button[data-action]');
    botones.forEach(b => b.disabled = false);
    alert('No se pudo eliminar el pedido. Revisa la consola para más detalles.');
  }
}

// --- FUNCIÓN PARA MANEJAR EL FORMULARIO DE NUEVO PEDIDO ---
function configurarModalNuevoPedido(empresaId) {
  const btnNuevoPedido = document.getElementById("btn-nuevo-pedido");
  const modalElement = document.getElementById("modalNuevoPedido");
  
  if (!btnNuevoPedido || !modalElement) return;

  // Creamos una instancia del Modal de Bootstrap para poder controlarlo con JS
  const modal = new bootstrap.Modal(modalElement);
  
  // 1. Abrir el modal
  btnNuevoPedido.addEventListener("click", () => {
    modal.show();
  });

  // 2. Manejar el envío del formulario
  const form = document.getElementById("form-nuevo-pedido");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const botonGuardar = form.querySelector("button[type='submit']");
    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando...';

    try {
      // Capturamos los datos del formulario
      const cliente = document.getElementById("cliente-nombre").value;
      const descripcion = document.getElementById("pedido-descripcion").value;
      const fecha = document.getElementById("pedido-fecha").value;

      // Creamos el objeto para guardar en Firestore
      const nuevoPedido = {
        cliente: cliente,
        descripcion: descripcion,
        fechaEntrega: new Date(fecha), // Convertimos el string de fecha a objeto Date
        estado: 'Pendiente', // Todos los pedidos nuevos empiezan como 'Pendiente'
        empresaId: empresaId // ¡Importante! Vinculamos el pedido a la empresa
      };

      // Guardamos el nuevo documento en la colección 'pedidos'
      const pedidosRef = collection(db, "pedidos");
      await addDoc(pedidosRef, nuevoPedido);

      // Cerramos el modal, reseteamos el formulario y recargamos la lista
      modal.hide();
      form.reset();
      cargarPedidos(empresaId);

    } catch (error) {
      console.error("Error al guardar el nuevo pedido:", error);
      alert("No se pudo guardar el pedido.");
    } finally {
      // Nos aseguramos de que el botón se reactive, incluso si hay un error
      botonGuardar.disabled = false;
      botonGuardar.textContent = 'Guardar Pedido';
    }
  });
}

// --- FUNCIÓN PARA CARGAR LOS DETALLES DE UN PEDIDO ESPECÍFICO ---
async function cargarDetallePedido(idPedido) {
  const container = document.getElementById("detalle-pedido-container");
  if (!container) return;

  try {
    const pedidoRef = doc(db, "pedidos", idPedido);
    const docSnap = await getDoc(pedidoRef);

    if (docSnap.exists()) {
      const pedido = docSnap.data();
      const fechaEntregaStr = pedido.fechaEntrega?.toDate().toLocaleDateString() || 'No definida';
      
      // Creamos el HTML para mostrar los detalles principales
      container.innerHTML = `
        <h2>${pedido.descripcion}</h2>
        <p class="lead">Cliente: <strong>${pedido.cliente}</strong></p>
        <ul class="list-unstyled">
          <li><strong>Fecha de Entrega:</strong> ${fechaEntregaStr}</li>
          <li><strong>Estado Actual:</strong> <span class="badge ${getBadgeClass(pedido.estado)}">${pedido.estado}</span></li>
        </ul>
      `;
    } else {
      container.innerHTML = `<h2>Error: No se encontró el pedido.</h2>`;
    }
  } catch (error) {
    console.error("Error al cargar detalle del pedido:", error);
    container.innerHTML = `<h2>Error al cargar los datos.</h2>`;
  }
}

// --- FUNCIÓN PARA CARGAR Y MANEJAR EL HISTORIAL DE NOTAS ---
async function configurarBitacora(idPedido, perfilUsuario) {
  const listaHistorial = document.getElementById("lista-historial");
  const formNuevaNota = document.getElementById("form-nueva-nota");
  if (!listaHistorial || !formNuevaNota) return;

  const historialRef = collection(db, "pedidos", idPedido, "historial");

  // 1. Función para cargar las notas
  const cargarNotas = async () => {
    listaHistorial.innerHTML = 'Cargando...';
    const q = query(historialRef, orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      listaHistorial.innerHTML = '<li class="list-group-item">No hay notas en la bitácora.</li>';
      return;
    }
    listaHistorial.innerHTML = '';
    querySnapshot.forEach(doc => {
      const nota = doc.data();
      const fechaNota = nota.fecha?.toDate().toLocaleString() || 'Fecha no disponible';
      const item = `
        <li class="list-group-item">
          <p class="mb-1">${nota.nota}</p>
          <small class="text-muted">Por: ${nota.usuario} - ${fechaNota}</small>
        </li>
      `;
      listaHistorial.innerHTML += item;
    });
  };

  // 2. Manejar el envío del formulario para añadir una nueva nota
  formNuevaNota.addEventListener("submit", async (event) => {
    event.preventDefault();
    const textoNota = document.getElementById("nueva-nota-texto").value;
    const boton = formNuevaNota.querySelector("button");
    boton.disabled = true;

    try {
      await addDoc(historialRef, {
        nota: textoNota,
        usuario: perfilUsuario.Nombre, // Usamos el nombre del perfil
        fecha: serverTimestamp()
      });
      formNuevaNota.reset();
      cargarNotas(); // Recargamos la lista para ver la nueva nota
    } catch (error) {
      console.error("Error al guardar la nota:", error);
      alert("No se pudo guardar la nota.");
    } finally {
      boton.disabled = false;
    }
  });

  // 3. Cargar las notas por primera vez
  cargarNotas();
}

// --- FUNCIÓN PARA MANEJAR EL MODAL DE NUEVO CLIENTE ---
function configurarModalNuevoCliente(empresaId) {
  const modalElement = document.getElementById("modalNuevoCliente");
  if (!modalElement) { console.warn('modalNuevoCliente no encontrado en DOM'); return; }

  const modal = new bootstrap.Modal(modalElement);
  const form = document.getElementById("form-nuevo-cliente");
  if (!form) { console.warn('form-nuevo-cliente no encontrado en DOM'); return; }

  console.log('[setup] configurarModalNuevoCliente inicializado para empresaId=', empresaId);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const botonGuardar = form.querySelector("button[type='submit']");
    if (botonGuardar) {
      botonGuardar.disabled = true;
      const prevText = botonGuardar.textContent;
      botonGuardar.textContent = 'Guardando...';

      try {
        console.log('[submit] creando cliente...');
        const nombreEl = document.getElementById("nuevo-cliente-nombre");
        const telefonoEl = document.getElementById("nuevo-cliente-telefono");
        const nuevoCliente = {
          nombre: nombreEl ? nombreEl.value : '',
          telefono: telefonoEl ? telefonoEl.value : '',
          saldoFiado: 0,
          empresaId: empresaId
        };

        const clientesRef = collection(db, "clientes");
        const docRef = await addDoc(clientesRef, nuevoCliente);
        console.log('Cliente creado con id:', docRef.id);

        modal.hide();
        form.reset();
        cargarClientes(empresaId);
      } catch (error) {
        console.error("Error al guardar el nuevo cliente:", error);
        alert("No se pudo guardar el cliente. Revisa la consola para más detalles.");
      } finally {
        botonGuardar.disabled = false;
        botonGuardar.textContent = prevText || 'Guardar Cliente';
      }
    }
  });
}

// --- FUNCIONES PARA LA PÁGINA DE DETALLE DEL CLIENTE ---

// 1. CARGA LOS DATOS PRINCIPALES DEL CLIENTE (NOMBRE Y SALDO)
async function cargarDetalleCliente(idCliente) {
  const nombreTitulo = document.getElementById("cliente-nombre-titulo");
  const saldoTotal = document.getElementById("cliente-saldo-total");
  if (!nombreTitulo || !saldoTotal) return;

  try {
    const clienteRef = doc(db, "clientes", idCliente);
    const docSnap = await getDoc(clienteRef);
    if (docSnap.exists()) {
      const cliente = docSnap.data();
      nombreTitulo.textContent = cliente.nombre;
      const saldo = cliente.saldoFiado || 0;
      saldoTotal.textContent = `C$ ${saldo.toFixed(2)}`;
      saldoTotal.className = saldo > 0 ? 'display-5 fw-bold text-danger' : 'display-5 fw-bold text-success';
    }
  } catch (error) {
    console.error("Error al cargar datos del cliente:", error);
    nombreTitulo.textContent = "Error al cargar";
  }
}

// 2. CARGA EL HISTORIAL DE MOVIMIENTOS Y CONFIGURA LA ELIMINACIÓN
async function cargarMovimientos(idCliente) {
  // Soporta dos variantes de HTML:
  // 1) Una sola sección: #lista-movimientos (historial combinado)
  // 2) Secciones separadas: #lista-cargos-pendientes y #lista-movimientos-pagados
  const listaCombinada = document.getElementById('lista-movimientos');
  const listaCargos = document.getElementById('lista-cargos-pendientes');
  const listaPagados = document.getElementById('lista-movimientos-pagados');

  // Si no hay ningún contenedor visible, salimos
  if (!listaCombinada && !listaCargos && !listaPagados) return;

  const movimientosRef = collection(db, "clientes", idCliente, "movimientosFiado");
  const q = query(movimientosRef, orderBy("fecha", "desc"));
  const querySnapshot = await getDocs(q);

  // Limpiamos contenedores
  if (listaCombinada) listaCombinada.innerHTML = '';
  if (listaCargos) listaCargos.innerHTML = '';
  if (listaPagados) listaPagados.innerHTML = '';

  if (querySnapshot.empty) {
    if (listaCombinada) listaCombinada.innerHTML = '<div class="alert alert-secondary">No hay movimientos registrados.</div>';
    if (listaCargos) listaCargos.innerHTML = '<div class="alert alert-secondary">No hay cargos pendientes.</div>';
    if (listaPagados) listaPagados.innerHTML = '<div class="alert alert-secondary">No hay movimientos registrados.</div>';
    return;
  }

  querySnapshot.forEach(docSnap => {
    const movimiento = docSnap.data();
    const idMovimiento = docSnap.id;
    const esCargo = movimiento.tipo === 'cargo';

    const item = document.createElement('div');
    item.className = `list-group-item list-group-item-action d-flex justify-content-between align-items-center ${esCargo ? '' : 'list-group-item-success'}`;
    item.innerHTML = `
      <div>
        <p class="mb-1 fw-bold">${esCargo ? movimiento.descripcion : 'Abono: ' + movimiento.descripcion}</p>
        <small class="text-muted">${movimiento.fecha?.toDate().toLocaleString()}</small>
      </div>
      <div class="d-flex align-items-center">
        <span class="fw-bold me-3 ${esCargo ? 'text-danger' : 'text-success'}">
          ${esCargo ? '+' : '-'} C$ ${movimiento.monto.toFixed(2)}
        </span>
        ${esCargo ? `<button class="btn btn-sm btn-outline-danger btn-icon" data-id-movimiento="${idMovimiento}" data-monto="${movimiento.monto}" title="Eliminar cargo"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>
    `;

    // Listener para eliminar cargos
    const btnEliminar = item.querySelector('button[data-id-movimiento]');
    if (btnEliminar) {
      btnEliminar.addEventListener('click', async () => {
        if (!confirm("¿Estás seguro de que quieres eliminar este cargo? Esta acción se restará del saldo deudor.")) return;

        const montoARestar = parseFloat(btnEliminar.dataset.monto);

        try {
          await deleteDoc(doc(db, "clientes", idCliente, "movimientosFiado", idMovimiento));
          const clienteRef = doc(db, "clientes", idCliente);
          await updateDoc(clienteRef, { saldoFiado: increment(-montoARestar) });
          cargarDetalleCliente(idCliente);
          cargarMovimientos(idCliente);
        } catch (err) {
          console.error('Error al eliminar cargo:', err);
          alert('No se pudo eliminar el cargo. Revisa la consola para más detalles.');
        }
      });
    }

    // Render según el contenedor disponible
    if (listaCombinada) {
      listaCombinada.appendChild(item);
    } else {
      if (esCargo && listaCargos) listaCargos.appendChild(item);
      if (!esCargo && listaPagados) listaPagados.appendChild(item);
    }
  });
}

// 3. CONFIGURA LOS FORMULARIOS PARA AÑADIR CARGOS Y ABONOS
function configurarFormulariosCliente(idCliente) {
  const formCargo = document.getElementById("form-nuevo-cargo");
  const formAbono = document.getElementById("form-nuevo-abono");
  if (!formCargo || !formAbono) return;

  // Manejar formulario de CARGO
  formCargo.addEventListener("submit", async (event) => {
    event.preventDefault();
    const monto = parseFloat(document.getElementById("cargo-monto").value);
    const descripcion = document.getElementById("cargo-descripcion").value;

    const nuevoMovimiento = {
      tipo: 'cargo',
      descripcion: descripcion,
      monto: monto,
      fecha: serverTimestamp()
    };

    // Guardamos el nuevo movimiento
    const movimientosRef = collection(db, "clientes", idCliente, "movimientosFiado");
    await addDoc(movimientosRef, nuevoMovimiento);
    
    // Actualizamos el saldo total del cliente
    const clienteRef = doc(db, "clientes", idCliente);
    await updateDoc(clienteRef, {
      saldoFiado: increment(monto)
    });

    formCargo.reset();
    cargarDetalleCliente(idCliente);
    cargarMovimientos(idCliente);
  });

  // Manejar formulario de ABONO
  formAbono.addEventListener("submit", async (event) => {
    event.preventDefault();
    const monto = parseFloat(document.getElementById("abono-monto").value);
    const descripcion = document.getElementById("abono-descripcion").value;

    const nuevoMovimiento = {
      tipo: 'abono',
      descripcion: descripcion,
      monto: monto,
      fecha: serverTimestamp()
    };

    // Guardamos el nuevo movimiento
    const movimientosRef = collection(db, "clientes", idCliente, "movimientosFiado");
    await addDoc(movimientosRef, nuevoMovimiento);
    
    // Actualizamos el saldo total del cliente (restando el abono)
    const clienteRef = doc(db, "clientes", idCliente);
    await updateDoc(clienteRef, {
      saldoFiado: increment(-monto)
    });

    formAbono.reset();
    cargarDetalleCliente(idCliente);
    cargarMovimientos(idCliente);
  });
}

// --- FUNCIÓN PARA ELIMINAR UN CLIENTE (Y SUS MOVIMIENTOS) ---
async function eliminarCliente(idCliente) {
  if (!confirm('¿Seguro que deseas eliminar este cliente y todos sus movimientos? Esta acción no se puede deshacer.')) return;

  const btn = document.getElementById('btn-eliminar-cliente');
  if (btn) btn.disabled = true;

  try {
    // 1) Borrar todos los documentos de la subcolección movimientosFiado
    const movimientosRef = collection(db, 'clientes', idCliente, 'movimientosFiado');
    const snapshot = await getDocs(movimientosRef);
    const promises = [];
    snapshot.forEach(docSnap => {
      promises.push(deleteDoc(doc(db, 'clientes', idCliente, 'movimientosFiado', docSnap.id)));
    });
    await Promise.all(promises);

    // 2) Borrar el documento del cliente
    await deleteDoc(doc(db, 'clientes', idCliente));

    // 3) Redirigir al dashboard
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    alert('No se pudo eliminar el cliente. Revisa la consola para más detalles.');
    if (btn) btn.disabled = false;
  }
}

// --- PUNTO DE ENTRADA PRINCIPAL (ACTUALIZADO PARA CLIENTES) ---
authGuard(async (user) => {
  setupLogoutButton();
  try {
    const usuarioRef = doc(db, "usuarios", user.uid);
    const docSnap = await getDoc(usuarioRef);
    if (!docSnap.exists()) throw new Error("Perfil no encontrado.");

        const perfilUsuario = docSnap.data();
    document.getElementById('navbar-user-name').textContent = perfilUsuario.Nombre || 'Usuario';
    const empresaId = perfilUsuario.empresaId;
    
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id'); // Usaremos 'id' como un nombre genérico

    if (document.getElementById('detalle-pedido-container')) {
      // Estamos en pedido.html
      cargarDetallePedido(id);
      configurarBitacora(id, perfilUsuario);
    } else if (document.getElementById('detalle-cliente-container') || document.getElementById('cliente-nombre-titulo') || document.getElementById('lista-movimientos')) {
      // Detectamos cliente.html incluso si el wrapper 'detalle-cliente-container' no está presente.
      // Soporta variantes del HTML: algunos templates incluyen directamente #cliente-nombre-titulo o #lista-movimientos.
      if (!id) {
        const nombreTitulo = document.getElementById('cliente-nombre-titulo');
        if (nombreTitulo) nombreTitulo.textContent = 'ID de cliente no especificado en la URL.';
      } else {
        cargarDetalleCliente(id);
        try { cargarMovimientos(id); } catch (e) { console.warn('cargarMovimientos falló', e); }
        try { configurarFormulariosCliente(id); } catch (e) { console.warn('configurarFormulariosCliente falló', e); }
      }

    } else {
      // Estamos en dashboard.html
      await cargarPedidos(empresaId);
      // Cargamos clientes para la pestaña de Clientes
      try { cargarClientes(empresaId); } catch(e) { console.warn('cargarClientes no disponible', e); }
      if (typeof configurarAccionesRapidas === 'function') configurarAccionesRapidas(empresaId);
      if (typeof configurarModalNuevoPedido === 'function') configurarModalNuevoPedido(empresaId);
      if (typeof configurarModalNuevoCliente === 'function') configurarModalNuevoCliente(empresaId);
    }
  } catch (error) {
    console.error("Error crítico:", error);
  }
});

// --- Leyenda flotante: toggle y cierre al clicar fuera (funciona sólo si los elementos existen) ---
(function initLegendToggle(){
  const legendToggle = document.getElementById('legend-toggle');
  const legendCard = document.getElementById('legend-card');
  if (!legendToggle || !legendCard) return;

  legendToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    legendCard.classList.toggle('show');
    // aria-hidden
    const shown = legendCard.classList.contains('show');
    legendCard.setAttribute('aria-hidden', shown ? 'false' : 'true');
  });

  // Cerrar al clicar fuera
  document.addEventListener('click', (e) => {
    if (!legendCard.classList.contains('show')) return;
    if (e.target === legendToggle) return;
    if (!legendCard.contains(e.target)) {
      legendCard.classList.remove('show');
      legendCard.setAttribute('aria-hidden', 'true');
    }
  });
})();