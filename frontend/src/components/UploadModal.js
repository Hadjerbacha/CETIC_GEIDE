import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import UploadModal from './UploadModal';

const TestPage = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <>
      <Button onClick={() => setShowUploadModal(true)}>Ouvrir modal</Button>
      <UploadModal show={showUploadModal} onHide={() => setShowUploadModal(false)} />
    </>
  );
};

export default TestPage;
