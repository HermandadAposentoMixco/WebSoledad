import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth:{
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export async function enviarCorreoDevoto(data){
  await transporter.sendMail({
    from: `"Hermandad Soledad" <${process.env.EMAIL_USER}>`,
    to: data.correo,
    subject: "Comprobante de Registro",
    html: `
      <h2>Registro completado</h2>
      <p><b>CUI:</b> ${data.cui}</p>
      <p><b>Nombre:</b> ${data.nombres} ${data.apellidos}</p>
      <p><b>Turno:</b> ${data.nota}</p>
    `
  });
}
