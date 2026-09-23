/**
 * Siembra el contenido base del sitio: ajustes, FAQs, testimonios de muestra,
 * asesores placeholder y dos guías del blog.
 *
 * Idempotente: cada registro se busca por su clave natural (pregunta, nombre,
 * slug) y solo se crea si no existe, así se puede correr en cada deploy sin
 * pisar lo que la clienta ya editó desde el admin.
 *
 * Uso: pnpm seed:content
 */
import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { Advisor } from "../models/advisor.model";
import { Faq } from "../models/faq.model";
import { Post } from "../models/post.model";
import { Settings, SETTINGS_KEY } from "../models/settings.model";
import { Testimonial } from "../models/testimonial.model";

const POPULAR_SEARCHES = [
  { label: "Casas en Cumbayá", query: { type: "casa", sector: "cumbaya" } },
  { label: "Departamentos en Tumbaco", query: { type: "departamento", sector: "tumbaco" } },
  { label: "Terrenos en Puembo", query: { type: "terreno", sector: "puembo" } },
];

const FAQS = [
  {
    question: "¿Qué es la alícuota y quién la paga?",
    answer:
      "La alícuota es el valor mensual que cada propietario aporta para mantener las áreas comunes de un conjunto o edificio: guardianía, limpieza, jardinería, ascensores, piscina y fondo de reserva. La paga el propietario (o el arrendatario, si así se acuerda). En cada propiedad te indicamos el valor actual para que lo incluyas en tu presupuesto.",
  },
  {
    question: "¿Cuánto cuestan los gastos notariales y de escrituración en Quito?",
    answer:
      "Como referencia, entre notaría, impuestos municipales (alcabala y registro) e inscripción en el Registro de la Propiedad, el comprador suele destinar entre el 1,5 % y el 3 % del valor de la propiedad. El vendedor paga la plusvalía municipal, si aplica. Te damos un estimado por escrito antes de firmar la promesa de compraventa.",
  },
  {
    question: "¿Puedo comprar con crédito hipotecario del BIESS?",
    answer:
      "Sí. Si eres afiliado al IESS con al menos 36 aportaciones (las últimas 12 consecutivas) puedes solicitar un crédito hipotecario del BIESS para vivienda terminada o por construir. También trabajamos con bancos privados y cooperativas. Te acompañamos en la precalificación y en la entrega de documentos.",
  },
  {
    question: "¿Qué es el avalúo y por qué lo pide el banco?",
    answer:
      "Es la valoración técnica de la propiedad que hace un perito calificado. El banco o el BIESS la usa para definir cuánto te puede prestar (normalmente hasta el 70–80 % del avalúo). Conviene hacerlo al inicio para evitar sorpresas si el avalúo sale por debajo del precio pactado.",
  },
  {
    question: "¿Qué documentos necesito para comprar una propiedad?",
    answer:
      "Cédula y certificado de votación de los compradores (y del cónyuge si estás casado), y si financias: roles de pago o declaraciones de impuestos, estados de cuenta y la precalificación del banco. Del lado del vendedor revisamos escrituras, certificado de gravámenes, pago del predial y, en conjuntos, el certificado de no adeudar alícuotas.",
  },
  {
    question: "¿Cómo funciona la reserva de una unidad en un proyecto en planos?",
    answer:
      "Normalmente se reserva con un valor inicial, luego se firma una promesa de compraventa y se paga una entrada en cuotas durante la construcción. El saldo se cubre a la entrega con recursos propios o crédito hipotecario. Revisamos contigo el cronograma, las garantías de la constructora y la fecha de entrega.",
  },
  {
    question: "Quiero vender mi propiedad, ¿cómo me ayudan?",
    answer:
      'Hacemos una valoración con datos reales de la zona, fotografía profesional, publicación en nuestros canales y filtro de compradores calificados. Te acompañamos en la negociación, la promesa y la firma en notaría. Escríbenos desde la sección "Vender mi propiedad" y te contactamos.',
  },
  {
    question: "¿Qué impuesto paga el vendedor al vender un inmueble?",
    answer:
      "El vendedor paga el impuesto a la utilidad o plusvalía municipal sobre la ganancia obtenida entre la compra y la venta, con deducciones por años de tenencia y mejoras. Además, debe estar al día en el impuesto predial. Te orientamos para calcularlo antes de fijar el precio.",
  },
];

const TESTIMONIALS = [
  {
    name: "María Fernanda P.",
    text: "Nos ayudaron a encontrar una casa en Cumbayá que cumplía todo lo que buscábamos. Muy claros con los costos y acompañándonos hasta la notaría.",
    rating: 5,
    context: "Compró una casa en Cumbayá",
  },
  {
    name: "Andrés V.",
    text: "Vendí mi departamento en Tumbaco en menos tiempo del que esperaba. La valoración fue realista y las visitas llegaban con compradores calificados.",
    rating: 5,
    context: "Vendió su departamento en Tumbaco",
  },
  {
    name: "Carolina y Diego",
    text: "Compramos en planos y nos explicaron cada paso: reserva, promesa y crédito. Se nota que conocen muy bien el valle.",
    rating: 5,
    context: "Compraron en un proyecto en Puembo",
  },
  {
    name: "Jorge M.",
    text: "Buscaba un terreno para construir y me mostraron opciones que no estaban en ningún portal. Atención rápida por WhatsApp.",
    rating: 5,
    context: "Compró un terreno en Nayón",
  },
];

const POSTS = [
  {
    title: "Cómo comprar una casa en Cumbayá: guía 2026",
    slug: "como-comprar-una-casa-en-cumbaya-guia-2026",
    excerpt:
      "Presupuesto, financiamiento, documentos y costos de cierre: todo lo que necesitas saber antes de comprar casa en Cumbayá.",
    content: `Cumbayá sigue siendo una de las zonas más buscadas del valle por su clima, su oferta de colegios y universidades y su cercanía a Quito por la Ruta Viva y la Interoceánica. Si estás pensando en comprar casa aquí, esta guía te ayuda a ordenar el proceso.

## 1. Define tu presupuesto real

Al precio de la casa súmale entre el **1,5 % y el 3 %** para gastos de escrituración e impuestos, y considera la **alícuota** mensual si la casa está en un conjunto. Si vas a financiar, calcula que la cuota no supere el 30–35 % de tus ingresos familiares.

## 2. Precalifica tu crédito

- **BIESS**: tasas competitivas si eres afiliado con al menos 36 aportaciones.
- **Bancos privados**: suelen financiar hasta el 70–80 % del avalúo.
- **Recursos propios**: te dan más poder de negociación.

## 3. Elige el sector dentro de Cumbayá

No es lo mismo vivir cerca del parque central que en las urbanizaciones de Lumbisí o San Patricio. Revisa tiempos de traslado a tu trabajo y al colegio de tus hijos en hora pico.

## 4. Revisa la documentación

Antes de firmar una promesa pide el **certificado de gravámenes**, el pago del predial al día y, en conjuntos, el certificado de no adeudar alícuotas.

## 5. Negocia y cierra

Con el avalúo en mano, negocia el precio y firma la promesa de compraventa. Luego viene la escritura en notaría y la inscripción en el Registro de la Propiedad.

¿Quieres que te acompañemos? [Mira las casas disponibles en Cumbayá](/propiedades?type=casa&sector=cumbaya) o escríbenos por WhatsApp.`,
  },
  {
    title: "Qué es la alícuota y cuánto cuesta en el valle",
    slug: "que-es-la-alicuota-y-cuanto-cuesta-en-el-valle",
    excerpt:
      "La alícuota cubre el mantenimiento de las áreas comunes. Te contamos qué incluye y rangos de referencia en Cumbayá y Tumbaco.",
    content: `Si vas a comprar en un conjunto o edificio, la **alícuota** es un gasto fijo que debes tener presente desde el primer día.

## ¿Qué es la alícuota?

Es el aporte mensual de cada propietario para mantener las áreas y servicios comunes. Se calcula según el porcentaje que tu inmueble representa dentro del conjunto (metros cuadrados).

## ¿Qué suele incluir?

- Guardianía y seguridad privada
- Limpieza y jardinería de áreas comunes
- Mantenimiento de ascensores, piscina, gimnasio y bombas de agua
- Luz y agua de áreas comunes
- Fondo de reserva para reparaciones

## ¿Cuánto cuesta en el valle?

Como referencia, en Cumbayá y Tumbaco una casa en conjunto pequeño puede pagar desde **USD 60 a 150** al mes, y un departamento en edificio con amenidades completas entre **USD 80 y 250**. Conjuntos con piscina, club house o guardianía 24/7 están en la parte alta del rango.

## Consejos antes de comprar

- Pide el valor actual por escrito y el reglamento del conjunto.
- Pregunta si hay cuotas extraordinarias aprobadas.
- Exige el certificado de no adeudar alícuotas antes de escriturar.

En cada propiedad publicada te indicamos si tiene alícuota y su valor. [Explora propiedades](/propiedades).`,
  },
];

async function seedSettings() {
  const existing = await Settings.findOne({ key: SETTINGS_KEY });
  if (!existing) {
    await Settings.create({ key: SETTINGS_KEY, popularSearches: POPULAR_SEARCHES });
    console.log("✔ Ajustes creados con valores por defecto");
    return;
  }
  // Solo se completa lo que está vacío; lo editado por la clienta se respeta.
  if (!existing.popularSearches?.length) {
    existing.popularSearches = POPULAR_SEARCHES;
    await existing.save();
    console.log("✔ Búsquedas populares agregadas a los ajustes");
  } else {
    console.log("• Ajustes ya existen, sin cambios");
  }
}

async function seedFaqs() {
  let created = 0;
  for (const [i, faq] of FAQS.entries()) {
    if (await Faq.exists({ question: faq.question })) continue;
    await Faq.create({ ...faq, order: i, isPublished: true });
    created++;
  }
  console.log(`✔ FAQs: ${created} nuevas (${FAQS.length - created} ya existían)`);
}

async function seedTestimonials() {
  let created = 0;
  for (const [i, t] of TESTIMONIALS.entries()) {
    if (await Testimonial.exists({ name: t.name })) continue;
    await Testimonial.create({ ...t, photo: null, order: i, isActive: true });
    created++;
  }
  console.log(`✔ Testimonios: ${created} nuevos (${TESTIMONIALS.length - created} ya existían)`);
}

async function seedAdvisors() {
  let created = 0;
  for (let i = 1; i <= 4; i++) {
    const name = `Asesor/a G3i ${i}`;
    if (await Advisor.exists({ name })) continue;
    // Inactivos: la clienta completa nombre, foto y contacto antes de mostrarlos.
    await Advisor.create({ name, role: "Asesor/a inmobiliario/a", order: i - 1, isActive: false });
    created++;
  }
  console.log(`✔ Asesores placeholder: ${created} nuevos`);
}

async function seedPosts() {
  let created = 0;
  for (const post of POSTS) {
    if (await Post.exists({ slug: post.slug })) continue;
    await Post.create({ ...post, cover: null, status: "published", publishedAt: new Date() });
    created++;
  }
  console.log(`✔ Blog: ${created} artículos nuevos (${POSTS.length - created} ya existían)`);
}

async function main() {
  console.log("Conectando a MongoDB...");
  await mongoose.connect(env.DB_URI);

  await seedSettings();
  await seedFaqs();
  await seedTestimonials();
  await seedAdvisors();
  await seedPosts();

  await mongoose.disconnect();
  console.log("Listo.");
}

main().catch(async (error) => {
  console.error("✖ Falló el seed de contenido:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
