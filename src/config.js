export const API_BASE_URL = "https://script.google.com/macros/s/AKfycbwiiniCuBWPeSe34hZCOvHR43MR3OdwocANhNwrklN5YkKGINJoEFY7trSdHHnj86U/exec";

export const MOCK_CLIENTS = [
  {
    id_cliente: "22",
    nombre: "Cliente Wilde 22",
    direccion: "BARADERO 6140",
    localidad: "WILDE",
    telefono: "1162625858",
    lista_precio: 1,
    horarios: ["Lunes 8 am", "Martes 8 am", "Miercoles 8 am"],
  },
  {
    id_cliente: "24",
    nombre: "Cliente Wilde 24",
    direccion: "AV LAS FLORES 883",
    localidad: "WILDE",
    telefono: "1162625859",
    lista_precio: 2,
    horarios: ["Lunes 9 am", "Martes 9 am", "Miercoles 9 am"],
  },
];

export const MOCK_PRODUCTS = [
  { sku: "BOT20", nombre: "Botellon 20 litros", precio_lista_1: 10000, precio_lista_2: 9000, image_url: "./assets/products/bot20.jpeg" },
  { sku: "BOT12", nombre: "Botellon 12 litros", precio_lista_1: 7000, precio_lista_2: 6000, image_url: "./assets/products/bot12.jpeg" },
  { sku: "BJS12", nombre: "Botellon 12 litros bajo sodio", precio_lista_1: 8000, precio_lista_2: 7000, image_url: "./assets/products/bot12_bajo_sodio.jpg" },
  { sku: "SODA", nombre: "Sifon de soda", precio_lista_1: 1200, precio_lista_2: 1200, image_url: "./assets/products/soda.png" },
  { sku: "SAB15", nombre: "Agua saborizada 1.5 litros", precio_lista_1: 2500, precio_lista_2: 2200, image_url: "./assets/products/sab15.jpeg" },
];

