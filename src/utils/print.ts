export type Paper = 'a4' | '80mm';

const pageRules: Record<Paper, string> = {
    a4: '@page { size: A4; margin: 10mm; } body { margin: 0; }',
    '80mm': '@page { size: 80mm auto; margin: 0; } body { margin: 0; width: 80mm; }',
};

export function savedPaper(): Paper {
    try {
        return localStorage.getItem('printPaper') === '80mm' ? '80mm' : 'a4';
    } catch (error) {
        return 'a4';
    }
}

export function rememberPaper(paper: Paper) {
    try {
        localStorage.setItem('printPaper', paper);
    } catch (error) {
        console.error('Could not remember paper size', error);
    }
}

export function printElement(element: HTMLElement, paper: Paper, title = 'Print') {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((node) => node.outerHTML).join('');
    const frame = iframe.contentWindow;
    const doc = frame?.document;
    if (!frame || !doc) return;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><title>${title}</title>${styles}<style>${pageRules[paper]} html, body { background: #fff !important; } .print-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; }</style></head><body>${element.outerHTML}</body></html>`);
    doc.close();
    const trigger = () => {
        frame.focus();
        frame.print();
        setTimeout(() => iframe.remove(), 1000);
    };
    if (doc.readyState === 'complete') {
        setTimeout(trigger, 300);
    } else {
        frame.onload = () => setTimeout(trigger, 300);
    }
}

export async function downloadPdf(element: HTMLElement, fileName = 'document') {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
    ]);
    const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
    });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const margin = 8;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printWidth = pageWidth - margin * 2;
    const printHeight = (canvas.height * printWidth) / canvas.width;
    const usable = pageHeight - margin * 2;
    const image = canvas.toDataURL('image/jpeg', 0.95);

    // a sheet that is only a little taller than the page is shrunk to fit rather than split
    if (printHeight <= usable * 1.12) {
        const height = Math.min(printHeight, usable);
        const width = (printWidth * height) / printHeight;
        pdf.addImage(image, 'JPEG', (pageWidth - width) / 2, margin, width, height);
        pdf.save(`${fileName}.pdf`);
        return;
    }

    let leftToPrint = printHeight;
    let position = margin;
    pdf.addImage(image, 'JPEG', margin, position, printWidth, printHeight);
    leftToPrint -= usable;
    while (leftToPrint > 0) {
        position -= usable;
        pdf.addPage();
        pdf.addImage(image, 'JPEG', margin, position, printWidth, printHeight);
        leftToPrint -= usable;
    }
    pdf.save(`${fileName}.pdf`);
}
