import "./legal.css";
export const metadata = {
  title: "docusignpdf",
  description: "PDF Sign tool (Day 1: preview)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial' }}>
        {children}
      </body>
    </html>
  );
}
