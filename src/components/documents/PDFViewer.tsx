interface PDFViewerProps {
  url: string;
}

const PDFViewer = ({ url }: PDFViewerProps) => {
  return (
    <div className="w-full h-full min-h-[70vh]">
      <iframe
        src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
        className="w-full h-full border-0 rounded-lg"
        title="PDF Viewer"
      />
    </div>
  );
};

export default PDFViewer;
