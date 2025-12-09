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
  const [showCamera, setShowCamera] = useState(false);  // ADD THIS
  const [stream, setStream] = useState(null);  // ADD THIS

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
      const hasImage = formData.image ? 'Yes' : 'No';
      console.log('Submitting with image:', hasImage);
      
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

      const response = await fetch(`https://backend.urbanflowph.com/api/public-reports`, {
        method: 'POST',
        body: submitData
      });

      if (response.ok) {
        const data = await response.json();
        alert('✅ Report submitted successfully!' + (formData.image ? '\n📷 Image uploaded' : ''));
        onSubmit();
        if (marker) marker.remove();
      } else {
        const errorData = await response.json();
        const errorMsg = `Failed to submit report\n\nStatus: ${response.status}\nError: ${errorData.error || 'Unknown error'}`;
        alert(errorMsg);
        console.error('Server error:', errorData);
      }
    } catch (error) {
      const errorMsg = `Network Error\n\nError: ${error.message}\n\nPlease check your internet connection.`;
      alert(errorMsg);
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ADD THESE THREE CAMERA FUNCTIONS HERE:
  const startCamera = async () => {
    try {
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
      } catch (e) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
      }
      
      setStream(mediaStream);
      setShowCamera(true);
      
      setTimeout(() => {
        const video = document.getElementById('camera-video');
        if (video) {
          video.srcObject = mediaStream;
        }
      }, 100);
    } catch (error) {
      console.error('Camera access error:', error);
      alert(`Could not access camera: ${error.message}\n\nPlease allow camera permissions in your browser.`);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    try {
      const video = document.getElementById('camera-video');
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (!blob) {
          alert('Failed to capture photo. Please try again.');
          return;
        }
        
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        setFormData({...formData, image: file});
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result);
          alert('Photo captured successfully!');
        };
        reader.readAsDataURL(file);
        
        stopCamera();
      }, 'image/jpeg', 0.95);
    } catch (error) {
      alert(`Error capturing photo: ${error.message}`);
      console.error('Capture error:', error);
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
          Lat:{position.lat.toFixed(5)}, Long:{position.lng.toFixed(5)}
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
              { value: 'accident', label: 'Accident', emoji: '⛐' },
              { value: 'flooding', label: 'Flooding', emoji: '⛈' },
              { value: 'roadwork', label: 'Road Work', emoji: '🛠' },
              { value: 'other', label: 'Other', emoji: '⚠' }
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
              className="flex-1 border-2 border-[#757575] text-[#757575] py-2 px-2 rounded-lg hover:bg-gray-300 transition text-sm font-semibold"
            >
              Choose from Gallery
            </button>
            <button
              type="button"
              onClick={() => {
                // Check if mobile device
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) {
                  // On mobile: use native camera
                  document.getElementById('mobile-camera').click();
                } else {
                  // On desktop: use our camera UI
                  startCamera();
                }
              }}
              className="flex-1 border-2 border-[#757575] text-[#757575] py-2 px-2 rounded-lg hover:bg-gray-300 transition text-sm font-semibold"
            >
              Take Photo
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
            id="mobile-camera"
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
                className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 transition font-bold"
              >
                ↩
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
       {/* Camera Modal - at the very end, before closing div */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-90 z-[10001] flex flex-col">
            <div className="flex-1 flex items-center justify-center p-4">
              <video 
                id="camera-video"
                autoPlay 
                playsInline
                className="max-w-full max-h-full rounded-lg"
              />
            </div>
            <div className="p-4 flex gap-3 justify-center">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-white text-gray-900 px-8 py-4 rounded-full hover:bg-gray-200 transition font-bold text-lg"
              >
                ◉
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="bg-red-600 text-white px-8 py-4 rounded-full hover:bg-red-700 transition font-bold text-lg"
              >
                ↩
              </button>
          </div>
        </div>
      )}
    </div>
  );
}