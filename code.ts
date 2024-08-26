// Show the HTML page in "ui.html".
figma.showUI(__html__);

// Handle messages received from the HTML page
figma.ui.onmessage = async (msg: { type: string }) => {

  // Handle the "select-frame" message
  if (msg.type === 'select-frame') {
    const selectedFrames = figma.currentPage.selection.filter(node => node.type === 'FRAME');
    
    if (selectedFrames.length === 0) {
      figma.notify("Please select a frame on the canvas.");
      return;
    }

    // Assuming you want to work with the first selected frame
    const selectedFrame = selectedFrames[0] as FrameNode;
    
    figma.notify(`Frame "${selectedFrame.name}" selected.`);
    console.log("Frame Selected: " + selectedFrame.name);
    // Store the selected frame globally if needed
    figma.root.setPluginData('selectedFrameId', selectedFrame.id);
    
  } else if (msg.type === 'create-palette') {

    const frameId = figma.root.getPluginData('selectedFrameId');
    if (!frameId) {
      figma.notify("No frame selected. Please select a frame first.");
      return;
    }

    try {
      // Await the result of getNodeByIdAsync and check if it's a FrameNode
      const node = await figma.getNodeByIdAsync(frameId);
      if (!node || node.type !== 'FRAME') {
        figma.notify("Selected frame is no longer available or is not a frame.");
        return;
      }

      const frame = node as FrameNode;

      // Export the frame as JPEG
      const jpegBytes = await exportFrameAsJPEG(frame);

      // Send the JPEG image to the API
      const colorPalette = await sendToAPI(jpegBytes);

      // Create rectangles with the colors from the palette on the canvas
      createColorPaletteOnCanvas(colorPalette);

    } catch (error) {
      console.error(error);
      figma.notify("An error occurred while exporting the image or sending it to the API.");
    }
  }
};

// Function to export a frame as JPEG
async function exportFrameAsJPEG(frame: FrameNode): Promise<Uint8Array> {
  const imageData = await frame.exportAsync({ format: 'JPG' });
  return imageData;
}

// Function to send the JPEG image data to the API and return the color palette
async function sendToAPI(imageData: Uint8Array): Promise<string[]> {
  const response = await fetch('http://localhost:5150/api/process-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg' // or 'image/jpeg' if it's a JPEG
    },
    body: imageData
  });

  if (!response.ok) {
    throw new Error(`Failed to send image to API: ${response.statusText}`);
  }

  const result = await response.json();
  console.log('Model Result:', result.color_palette);
  figma.notify("Image exported and palette received successfully.");

  return result.color_palette; // Assuming the API returns an array of color hex codes
}

// Function to create rectangles on the canvas with the colors from the palette
function createColorPaletteOnCanvas(colorPalette: string[]) {
  const nodes: SceneNode[] = [];
  
  colorPalette.forEach((color, index) => {
    const rect = figma.createRectangle();
    rect.x = 100 + (index * 110); // Position rectangles with some spacing
    rect.y = 100;
    rect.resize(100, 100);
    rect.fills = [{ type: 'SOLID', color: hexToRgb(color),boundVariables:{}}];

    figma.currentPage.appendChild(rect);
    nodes.push(rect);
  });

  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
}

// Helper function to convert hex color to RGB
function hexToRgb(hex: string): RGB {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return { r: r / 255, g: g / 255, b: b / 255 };
}
