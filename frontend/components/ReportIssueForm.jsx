import { useState } from 'react';

export default function ReportIssueForm({ position, onClose, onSubmit, marker }) {
  const [formData, setFormData] = useState({
    report_type: 'accident',
    severity: 'moderate',
    description: '',
    reporter_name: '',
    image: null
  });
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({...formData, image: file});
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('latitude', position.lat);
      submitData.append('longitude', position.lng);
      submitData.append('report_type', formData.report_type);
      submitData.append('severity', formData.severity);
      submitData.append('description', formData.description);
      submitData.append('reporter_name', formData.reporter_name || 'Anonymous');
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public-reports`, {
        method: 'POST',
        body: submitData
      });

      if (response.ok) {
        onSubmit();
        if (marker) marker.remove();
      } else {
        alert('Failed to submit report. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed right-0 top-0 bottom-0 bg-white shadow-2xl z-[10000] overflow-y-auto"
      style={{ width: '400px', maxWidth: '90vw' }}
    >
      {/* Header */}
      <div className="bg-orange-400 text-black p-4 sticky top-0">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Report Issue</h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200 text-3xl leading-none"
          >
            ×
          </button>
        </div>
        <p className="text-sm mt-2 opacity-90">
          📍 {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Type Selection */}
        <div>
          <label className="block text-sm font-semibold mb-3 text-black">
            What's the issue? *
          </label>
          <div className="grid grid-cols-2 gap-2 text-gray-600">
            {[
              { value: 'accident', label: 'Accident', emoji: '🚗' },
              { value: 'flooding', label: 'Flooding', emoji: '🌊' },
              { value: 'roadwork', label: 'Road Work', emoji: '🚧' },
              { value: 'other', label: 'Other', emoji: '⚠️' }
            ].map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => setFormData({...formData, report_type: type.value})}
                className={`p-3 rounded-lg border-2 transition text-sm font-medium flex items-center justify-center gap-2 ${
                  formData.report_type === type.value
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-lg">{type.emoji}</span>
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Severity */}
        <div>
        <label className="block text-sm font-semibold mb-3 text-gray-700">
            Severity *
        </label>
        <div className="grid grid-cols-3 gap-2">
            {[
            { value: 'minor', label: 'Minor', color: 'bg-blue-500' },
            { value: 'moderate', label: 'Moderate', color: 'bg-yellow-500' },
            { value: 'severe', label: 'Severe', color: 'bg-red-500' }
            ].map(sev => (
            <button
                key={sev.value}
                type="button"
                onClick={() => setFormData({...formData, severity: sev.value})}
                className={`p-3 rounded-lg border-2 transition text-sm font-medium ${
                formData.severity === sev.value
                    ? `${sev.color} text-white border-transparent`
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
            >
                {sev.label}
            </button>
            ))}
        </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Description *
          </label>
          <textarea 
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:outline-none text-sm"
            rows="4"
            placeholder="Describe what's happening..."
            required
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

       {/* Image Upload/Camera */}
        <div>
        <label className="block text-sm font-semibold mb-2 text-gray-700">
            Add Photo (Optional)
        </label>
        
        <div className="flex gap-2 mb-3">
            <button
            type="button"
            onClick={() => document.getElementById('file-upload').click()}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
            >
            📁 Choose from Gallery
            </button>
            <button
            type="button"
            onClick={() => document.getElementById('camera-capture').click()}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition text-sm font-semibold"
            >
            📷 Take Photo
            </button>
        </div>
        
        {/* Hidden file inputs */}
        <input 
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
        />
        <input 
            id="camera-capture"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
        />
        
        {imagePreview && (
            <div className="relative">
            <img 
                src={imagePreview} 
                alt="Preview" 
                className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
            />
            <button
                type="button"
                onClick={() => {
                setImagePreview(null);
                setFormData({...formData, image: null});
                }}
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 transition"
            >
                ✕
            </button>
            </div>
        )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-semibold mb-2 text-gray-700">
            Your Name (Optional)
          </label>
          <input 
            type="text"
            className="w-full border-2 border-gray-200 rounded-lg p-3 focus:border-orange-500 focus:outline-none text-sm"
            placeholder="Anonymous"
            value={formData.reporter_name}
            onChange={(e) => setFormData({...formData, reporter_name: e.target.value})}
          />
        </div>

        {/* Submit Button */}
        <button 
        type="submit"
        disabled={loading}
        className="w-full bg-orange-400 text-white py-4 rounded-lg hover:bg-orange-500 disabled:bg-gray-400 font-bold text-lg transition shadow-lg"
        >
        {loading ? 'Submitting...' : 'Submit Report'}
        </button>
      </form>
    </div>
  );
}