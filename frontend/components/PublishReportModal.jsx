import { useState } from 'react';

export default function PublishReportModal({ report, onClose, onPublish }) {
  const [duration, setDuration] = useState(2);

  const handlePublish = async () => {
    await onPublish(report.id, duration);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Publish Report to Public Map</h2>
        
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm font-medium mb-1">{report.report_type}</p>
          <p className="text-sm text-gray-600">{report.description}</p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            How long should this be visible?
          </label>
          <select 
            className="w-full border rounded p-2"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={1}>1 hour</option>
            <option value={2}>2 hours</option>
            <option value={4}>4 hours</option>
            <option value={8}>8 hours</option>
            <option value={24}>24 hours</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handlePublish}
            className="flex-1 bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
          >
            Publish
          </button>
          <button 
            onClick={onClose}
            className="flex-1 bg-gray-300 py-2 rounded hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}