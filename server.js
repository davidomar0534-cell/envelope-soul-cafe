const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

app.use('/img', express.static(__dirname + '/img'));

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);
const DB_NAME = "cafeteria_db";
const port = process.env.PORT || 8085;

let db;

async function conectarBaseDatos() {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log("✅ Conexión exitosa a MongoDB (" + DB_NAME + ")");
        app.listen(port, () => {
            console.log(`☕ Servidor de la Cafetería corriendo en el puerto ${port}`);
        });
    } catch (error) {
        console.error("❌ Error crítico al conectar a MongoDB:", error.message);
        process.exit(1);
    }
}

conectarBaseDatos();

// ============================================
// PRODUCTOS
// ============================================

// --- Obtener productos con tamaños ---
app.get('/api/productos/con-tamanos', async (req, res) => {
    try {
        const productos = await db.collection("productos").find({}).sort({ _id: 1 }).toArray();
        const productosConTamanos = productos.map(p => {
            if (p.tamaños && p.tamaños.length > 0) {
                return {
                    _id: p._id,
                    nombre: p.nombre,
                    tipo: p.tipo,
                    tamaños: p.tamaños
                };
            } else {
                return {
                    _id: p._id,
                    nombre: p.nombre,
                    tipo: p.tipo,
                    tamaños: [
                        { tamaño: "Único", precio: p.precio || 0, cantidad: p.cantidad || 0 }
                    ]
                };
            }
        });
        res.status(200).json(productosConTamanos);
    } catch (error) { 
        res.status(500).json({ success: false, mensaje: error.message }); 
    }
});

// --- Obtener productos con imágenes ---
app.get('/api/productos/con-imagenes', async (req, res) => {
    try {
        const productos = await db.collection("productos").find({}).sort({ _id: 1 }).toArray();
        const productosConImagenes = productos.map(p => {
            const imagen = p.imagen || '/img/productos/default.jpg';
            
            if (p.tamaños && p.tamaños.length > 0) {
                return {
                    _id: p._id,
                    nombre: p.nombre,
                    tipo: p.tipo,
                    tamaños: p.tamaños,
                    imagen: imagen
                };
            } else {
                return {
                    _id: p._id,
                    nombre: p.nombre,
                    tipo: p.tipo,
                    tamaños: [
                        { tamaño: "Único", precio: p.precio || 0, cantidad: p.cantidad || 0 }
                    ],
                    imagen: imagen
                };
            }
        });
        res.status(200).json(productosConImagenes);
    } catch (error) { 
        res.status(500).json({ success: false, mensaje: error.message }); 
    }
});

// --- Catálogo de productos ---
app.get('/api/productos', async (req, res) => {
    try {
        const prod = await db.collection("productos").find({}).sort({ _id: 1 }).toArray();
        res.status(200).json(prod);
    } catch (error) { 
        res.status(500).json({ success: false, mensaje: error.message }); 
    }
});

// --- Agregar producto ---
app.post('/api/productos/agregar', async (req, res) => {
    const { nombre, precio, cantidad, tipo, tamaños } = req.body;
    try {
        let nuevoProducto;
        
        if (tamaños && tamaños.length > 0) {
            nuevoProducto = {
                nombre: nombre,
                tipo: tipo,
                tamaños: tamaños.map(t => ({
                    tamaño: t.tamaño,
                    precio: parseFloat(t.precio),
                    cantidad: parseInt(t.cantidad)
                }))
            };
        } else {
            nuevoProducto = {
                nombre: nombre,
                precio: parseFloat(precio),
                cantidad: parseInt(cantidad),
                tipo: tipo,
                tamaños: [
                    { tamaño: "Único", precio: parseFloat(precio), cantidad: parseInt(cantidad) }
                ]
            };
        }

        const resultado = await db.collection("productos").insertOne(nuevoProducto);
        res.status(201).json({ 
            success: true, 
            mensaje: "Producto agregado con éxito.", 
            producto: { ...nuevoProducto, _id: resultado.insertedId } 
        });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// --- Editar información del producto ---
app.put('/api/productos/editar-info/:id', async (req, res) => {
    let idProducto;
    if (ObjectId.isValid(req.params.id)) {
        idProducto = new ObjectId(req.params.id);
    } else {
        idProducto = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);
    }
    const { nombre, tipo } = req.body;
    try {
        const resultado = await db.collection("productos").updateOne(
            { _id: idProducto },
            { $set: { nombre: nombre, tipo: tipo } }
        );
        if (resultado.matchedCount === 0) {
            return res.status(404).json({ success: false, mensaje: "Producto no encontrado." });
        }
        res.status(200).json({ success: true, mensaje: "Información actualizada correctamente." });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// --- Editar stock del producto ---
app.put('/api/productos/editar-stock/:id', async (req, res) => {
    let idProducto;
    if (ObjectId.isValid(req.params.id)) {
        idProducto = new ObjectId(req.params.id);
    } else {
        idProducto = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);
    }
    const { precio, cantidad, tamaño } = req.body;
    try {
        const producto = await db.collection("productos").findOne({ _id: idProducto });
        if (!producto) {
            return res.status(404).json({ success: false, mensaje: "Producto no encontrado." });
        }
        
        if (producto.tamaños && producto.tamaños.length > 0 && tamaño) {
            const tamañoIndex = producto.tamaños.findIndex(t => t.tamaño === tamaño);
            if (tamañoIndex !== -1) {
                await db.collection("productos").updateOne(
                    { _id: idProducto },
                    { 
                        $set: { 
                            [`tamaños.${tamañoIndex}.precio`]: parseFloat(precio),
                            [`tamaños.${tamañoIndex}.cantidad`]: parseInt(cantidad)
                        } 
                    }
                );
            } else {
                return res.status(404).json({ success: false, mensaje: `Tamaño "${tamaño}" no encontrado.` });
            }
        } else {
            await db.collection("productos").updateOne(
                { _id: idProducto },
                { $set: { precio: parseFloat(precio), cantidad: parseInt(cantidad) } }
            );
            if (producto.tamaños && producto.tamaños.length > 0) {
                const tamañosActualizados = producto.tamaños.map(t => ({
                    ...t,
                    precio: parseFloat(precio),
                    cantidad: parseInt(cantidad)
                }));
                await db.collection("productos").updateOne(
                    { _id: idProducto },
                    { $set: { tamaños: tamañosActualizados } }
                );
            }
        }
        res.status(200).json({ success: true, mensaje: "Inventario ajustado correctamente." });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// --- Eliminar producto ---
app.delete('/api/productos/eliminar/:id', async (req, res) => {
    let idProducto;
    if (ObjectId.isValid(req.params.id)) {
        idProducto = new ObjectId(req.params.id);
    } else {
        idProducto = isNaN(req.params.id) ? req.params.id : parseInt(req.params.id);
    }
    try {
        const resultado = await db.collection("productos").deleteOne({ _id: idProducto });
        if (resultado.deletedCount === 0) {
            return res.status(404).json({ success: false, mensaje: "El producto no existe." });
        }
        res.status(200).json({ success: true, mensaje: "Producto eliminado correctamente." });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// ============================================
// VALIDACIÓN DE CARRITO
// ============================================

app.post('/api/carrito/validar', async (req, res) => {
    const { id_producto, cantidad, tamaño } = req.body;
    try {
        let queryId;
        if (ObjectId.isValid(id_producto)) {
            queryId = new ObjectId(id_producto);
        } else {
            queryId = isNaN(id_producto) ? id_producto : parseInt(id_producto);
        }

        const producto = await db.collection("productos").findOne({ _id: queryId });
        if (!producto) {
            return res.status(404).json({ success: false, mensaje: "Producto no encontrado." });
        }
        
        let precio = 0;
        let stock = 0;
        
        if (producto.tamaños && producto.tamaños.length > 0) {
            const tamañoEncontrado = producto.tamaños.find(t => t.tamaño === tamaño);
            if (tamañoEncontrado) {
                precio = tamañoEncontrado.precio;
                stock = tamañoEncontrado.cantidad;
            } else {
                return res.status(400).json({ success: false, mensaje: `Tamaño "${tamaño}" no disponible.` });
            }
        } else {
            precio = producto.precio;
            stock = producto.cantidad;
        }
        
        if (stock < parseInt(cantidad)) {
            return res.status(400).json({ 
                success: false, 
                mensaje: `Stock insuficiente para ${tamaño}. Solo quedan ${stock} unidades.` 
            });
        }
        
        res.status(200).json({ 
            success: true, 
            producto: { 
                id: producto._id.toString(), 
                nombre: producto.nombre, 
                precio: precio,
                tamaño: tamaño,
                stock: stock
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// ============================================
// VENTAS (CAJERO)
// ============================================

app.post('/api/ventas/guardar', async (req, res) => {
    const { id_usuario, total, productos } = req.body;
    if (!id_usuario || !productos || productos.length === 0) {
        return res.status(400).json({ success: false, mensaje: "Datos de venta incompletos." });
    }

    try {
        let queryId;
        if (ObjectId.isValid(id_usuario)) {
            queryId = new ObjectId(id_usuario);
        } else {
            queryId = isNaN(id_usuario) ? id_usuario : parseInt(id_usuario);
        }

        const usuario = await db.collection("usuarios").findOne({ _id: queryId });
        if (!usuario || (usuario.rol !== 'cajero' && usuario.rol !== 'admin')) {
            return res.status(403).json({ success: false, mensaje: "Usuario no autorizado para realizar ventas." });
        }

        for (const item of productos) {
            let prodId;
            if (ObjectId.isValid(item.id_producto)) {
                prodId = new ObjectId(item.id_producto);
            } else {
                prodId = isNaN(item.id_producto) ? item.id_producto : parseInt(item.id_producto);
            }

            const producto = await db.collection("productos").findOne({ _id: prodId });
            
            if (producto.tamaños && producto.tamaños.length > 0) {
                const tamañoIndex = producto.tamaños.findIndex(t => t.tamaño === item.tamaño);
                if (tamañoIndex !== -1) {
                    const nuevaCantidad = producto.tamaños[tamañoIndex].cantidad - parseInt(item.cantidad);
                    await db.collection("productos").updateOne(
                        { _id: prodId },
                        { $set: { [`tamaños.${tamañoIndex}.cantidad`]: nuevaCantidad } }
                    );
                }
            } else {
                await db.collection("productos").updateOne(
                    { _id: prodId },
                    { $inc: { cantidad: -parseInt(item.cantidad) } }
                );
            }
        }

        const resultadoVenta = await db.collection("ventas").insertOne({
            id_usuario: queryId,
            nombre_cajero: usuario.usuario,
            total: parseFloat(total),
            productos: productos.map(item => ({
                ...item,
                precio: item.precio || 0
            })),
            fecha: new Date()
        });

        res.status(200).json({ success: true, id_venta: resultadoVenta.insertedId });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// --- Reporte de ventas ---
app.get('/api/ventas/reporte', async (req, res) => {
    try {
        const ventas = await db.collection("ventas").find({}).sort({ fecha: -1 }).toArray();
        res.status(200).json(ventas);
    } catch (error) { 
        res.status(500).json({ success: false, mensaje: error.message }); 
    }
});

// --- Limpiar reporte de ventas ---
app.delete('/api/ventas/limpiar', async (req, res) => {
    const id_usuario = req.headers['x-user-id']; 
    if (!id_usuario) {
        return res.status(400).json({ success: false, mensaje: "Identificación de usuario requerida." });
    }
    try {
        let queryId;
        if (ObjectId.isValid(id_usuario)) {
            queryId = new ObjectId(id_usuario);
        } else {
            queryId = isNaN(id_usuario) ? id_usuario : parseInt(id_usuario);
        }
        const usuario = await db.collection("usuarios").findOne({ _id: queryId });
        if (!usuario || usuario.rol !== 'admin') {
            return res.status(403).json({ success: false, mensaje: "Acceso denegado. Solo el administrador puede vaciar el reporte." });
        }
        await db.collection("ventas").deleteMany({});
        res.status(200).json({ success: true, mensaje: "Reporte de ventas limpiado por el Administrador con éxito." });
    } catch (error) { 
        res.status(500).json({ success: false, mensaje: error.message }); 
    }
});

// ============================================
// USUARIOS / LOGIN
// ============================================

app.post('/api/login', async (req, res) => {
    const { usua, contra } = req.body;
    try {
        const user = await db.collection("usuarios").findOne({ usuario: usua, contraseña: contra });
        if (user) {
            res.status(200).json({ 
                success: true, 
                _id: user._id.toString(), 
                usuario: user.usuario, 
                rol: user.rol 
            });
        } else {
            res.status(401).json({ success: false, mensaje: "Usuario o contraseña incorrectos." });
        }
    } catch (error) { 
        res.status(500).json({ success: false, mensaje: error.message }); 
    }
});

app.post('/api/usuarios/registrar-cajero', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const ultimoUsuario = await db.collection("usuarios").find({}).sort({ _id: -1 }).limit(1).toArray();
        const nuevoId = ultimoUsuario.length > 0 ? ultimoUsuario[0]._id + 1 : 1;
        const nuevoCajero = {
            _id: nuevoId,
            usuario: usuario,
            contraseña: password,
            rol: "cajero"
        };
        await db.collection("usuarios").insertOne(nuevoCajero);
        res.status(201).json({ success: true, mensaje: "Cajero registrado con éxito." });
    } catch (error) {
        res.status(500).json({ success: false, mensaje: error.message });
    }
});

// ============================================
// PEDIDOS EN LÍNEA (TIENDA VIRTUAL)
// ============================================

// --- Guardar pedido del cliente ---
app.post('/api/pedidos/guardar', async (req, res) => {
    const { cliente, productos, total, metodo_pago, estado } = req.body;
    
    if (!cliente || !productos || productos.length === 0) {
        return res.status(400).json({ 
            success: false, 
            mensaje: "Datos del pedido incompletos." 
        });
    }

    try {
        const nuevoPedido = {
            cliente: {
                id_cliente: cliente.id_cliente || null,
                nombre: cliente.nombre || 'Cliente anónimo',
                email: cliente.email || '',
                telefono: cliente.telefono || '',
                direccion: cliente.direccion || ''
            },
            productos: productos.map(item => ({
                id_producto: item.id_producto || '',
                nombre: item.nombre || 'Producto',
                tamaño: item.tamaño || 'Único',
                precio: parseFloat(item.precio) || 0,
                cantidad: parseInt(item.cantidad) || 1
            })),
            total: parseFloat(total) || 0,
            metodo_pago: metodo_pago || 'Efectivo',
            estado: estado || 'Pendiente',
            fecha: new Date(),
            origen: 'tienda_online'
        };

        const resultado = await db.collection("pedidos").insertOne(nuevoPedido);
        
        res.status(201).json({ 
            success: true, 
            mensaje: "Pedido guardado correctamente.",
            pedido: { 
                _id: resultado.insertedId,
                ...nuevoPedido
            }
        });
    } catch (error) {
        console.error("Error al guardar pedido:", error);
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- Obtener todos los pedidos ---
app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidos = await db.collection("pedidos")
            .find({})
            .sort({ fecha: -1 })
            .toArray();
        res.status(200).json(pedidos);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- Obtener un pedido específico ---
app.get('/api/pedidos/:id', async (req, res) => {
    try {
        let idPedido;
        if (ObjectId.isValid(req.params.id)) {
            idPedido = new ObjectId(req.params.id);
        } else {
            return res.status(400).json({ 
                success: false, 
                mensaje: "ID de pedido inválido." 
            });
        }

        const pedido = await db.collection("pedidos").findOne({ _id: idPedido });
        
        if (!pedido) {
            return res.status(404).json({ 
                success: false, 
                mensaje: "Pedido no encontrado." 
            });
        }

        res.status(200).json(pedido);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- Actualizar estado de un pedido ---
app.put('/api/pedidos/:id/estado', async (req, res) => {
    const { estado } = req.body;
    const estadosValidos = ['Pendiente', 'Confirmado', 'Preparando', 'Listo', 'Entregado', 'Devolución', 'Cancelado'];

    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ 
            success: false, 
            mensaje: "Estado no válido." 
        });
    }

    try {
        let idPedido;
        if (ObjectId.isValid(req.params.id)) {
            idPedido = new ObjectId(req.params.id);
        } else {
            return res.status(400).json({ 
                success: false, 
                mensaje: "ID de pedido inválido." 
            });
        }

        const resultado = await db.collection("pedidos").updateOne(
            { _id: idPedido },
            { 
                $set: { 
                    estado: estado,
                    fecha_actualizacion: new Date()
                } 
            }
        );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                mensaje: "Pedido no encontrado." 
            });
        }

        res.status(200).json({ 
            success: true, 
            mensaje: `Estado actualizado a "${estado}"` 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- Eliminar un pedido ---
app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        let idPedido;
        if (ObjectId.isValid(req.params.id)) {
            idPedido = new ObjectId(req.params.id);
        } else {
            return res.status(400).json({ 
                success: false, 
                mensaje: "ID de pedido inválido." 
            });
        }

        const resultado = await db.collection("pedidos").deleteOne({ _id: idPedido });

        if (resultado.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                mensaje: "Pedido no encontrado." 
            });
        }

        res.status(200).json({ 
            success: true, 
            mensaje: "Pedido eliminado correctamente." 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- Estadísticas de pedidos ---
app.get('/api/pedidos/estadisticas', async (req, res) => {
    try {
        const resultado = await db.collection("pedidos").aggregate([
            {
                $group: {
                    _id: "$estado",
                    count: { $sum: 1 }
                }
            }
        ]).toArray();

        const estadisticas = {
            Pendiente: 0,
            Confirmado: 0,
            Preparando: 0,
            Listo: 0,
            Entregado: 0,
            Devolución: 0,
            Cancelado: 0,
            total: 0
        };

        resultado.forEach(item => {
            estadisticas[item._id] = item.count;
            estadisticas.total += item.count;
        });

        res.status(200).json(estadisticas);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// ============================================
// CLIENTES (REGISTRO Y LOGIN)
// ============================================

// --- REGISTRO DE CLIENTE ---
app.post('/api/clientes/registrar', async (req, res) => {
    const { nombre, email, telefono, password } = req.body;
    
    if (!nombre || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            mensaje: "Nombre, email y contraseña son obligatorios." 
        });
    }

    try {
        const existe = await db.collection("clientes").findOne({ email: email });
        if (existe) {
            return res.status(400).json({ 
                success: false, 
                mensaje: "Este email ya está registrado." 
            });
        }

        const nuevoCliente = {
            nombre: nombre,
            email: email,
            telefono: telefono || '',
            password: password,
            fecha_registro: new Date(),
            rol: 'cliente'
        };

        const resultado = await db.collection("clientes").insertOne(nuevoCliente);
        
        res.status(201).json({ 
            success: true, 
            mensaje: "Registro exitoso. Ahora puedes iniciar sesión.",
            cliente: { 
                _id: resultado.insertedId, 
                nombre: nombre, 
                email: email 
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- LOGIN DE CLIENTE ---
app.post('/api/clientes/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            mensaje: "Email y contraseña son obligatorios." 
        });
    }

    try {
        const cliente = await db.collection("clientes").findOne({ 
            email: email, 
            password: password 
        });

        if (!cliente) {
            return res.status(401).json({ 
                success: false, 
                mensaje: "Email o contraseña incorrectos." 
            });
        }

        res.status(200).json({ 
            success: true, 
            mensaje: "Inicio de sesión exitoso.",
            cliente: { 
                _id: cliente._id.toString(), 
                nombre: cliente.nombre, 
                email: cliente.email,
                telefono: cliente.telefono || ''
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- OBTENER PEDIDOS DE UN CLIENTE ---
app.get('/api/clientes/:id/pedidos', async (req, res) => {
    try {
        let idCliente;
        if (ObjectId.isValid(req.params.id)) {
            idCliente = new ObjectId(req.params.id);
        } else {
            return res.status(400).json({ 
                success: false, 
                mensaje: "ID de cliente inválido." 
            });
        }

        // Buscar pedidos donde id_cliente sea ObjectId O string
        const pedidos = await db.collection("pedidos")
            .find({ 
                $or: [
                    { "cliente.id_cliente": idCliente },
                    { "cliente.id_cliente": idCliente.toString() }
                ]
            })
            .sort({ fecha: -1 })
            .toArray();

        res.status(200).json(pedidos);
    } catch (error) {
        console.error("Error al obtener pedidos:", error);
        res.status(500).json({ 
            success: false, 
            mensaje: error.message 
        });
    }
});

// --- ASOCIAR PEDIDO A CLIENTE ---
app.put('/api/pedidos/asociar-cliente', async (req, res) => {
    const { pedido_id, cliente_id, cliente_nombre, cliente_email } = req.body;

    if (!pedido_id || !cliente_id) {
        return res.status(400).json({
            success: false,
            mensaje: "Faltan datos para asociar el pedido."
        });
    }

    try {
        let idPedido;
        if (ObjectId.isValid(pedido_id)) {
            idPedido = new ObjectId(pedido_id);
        } else {
            return res.status(400).json({
                success: false,
                mensaje: "ID de pedido inválido."
            });
        }

        const resultado = await db.collection("pedidos").updateOne(
            { _id: idPedido },
            {
                $set: {
                    "cliente.id_cliente": cliente_id,
                    "cliente.nombre": cliente_nombre,
                    "cliente.email": cliente_email
                }
            }
        );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                mensaje: "Pedido no encontrado."
            });
        }

        res.status(200).json({
            success: true,
            mensaje: "Pedido asociado correctamente al cliente."
        });
    } catch (error) {
        console.error("Error al asociar pedido:", error);
        res.status(500).json({
            success: false,
            mensaje: error.message
        });
    }
});