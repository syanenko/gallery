//
// Exports all meshes in scene to POV-Ray 'mesh2' format
//
// Supported attributes: vertices, faces, normals, UVs, vertice colors.
// Mesh2 format: https://www.povray.org/documentation/view/3.60/68/ 
//
import {
	Color,
	ColorManagement,
	Matrix3,
	SRGBColorSpace,
	Vector2,
	Vector3
} from 'three';

class POVExporter {
  parse( object, flat_shading, vertex_colors, reverseVertices, sourceFile ) {

    let output = '';
    let surCount = 1;

    const vertex = new Vector3();
    const color = new Color();
    const normal = new Vector3();
    const uv = new Vector2();

    const face = [];
    const materials = [];
    
    function parseMesh( mesh ) {

      const geometry = mesh.geometry;
      const normalMatrixWorld = new Matrix3();

      // shortcuts
      const vertices = geometry.getAttribute( 'position' );
      const normals = geometry.getAttribute( 'normal' );
      const uvs = geometry.getAttribute( 'uv' );
      const colors = geometry.getAttribute( 'color' );
      const indices = geometry.getIndex();

      // name of the mesh object
      output += '#declare ' + mesh.name + ' = mesh2 {\n'
      surCount++;

      // vertices
      output += 'vertex_vectors {\n  ' + vertices.count + ',\n';
      if ( vertices !== undefined ) {
        for ( let i = 0; i < vertices.count; i ++ ) {
          vertex.fromBufferAttribute( vertices, i );
          // transform the vertex to world space
          vertex.applyMatrix4( mesh.matrixWorld );
          // transform the vertex to export format
          output += '  <' + vertex.x.toFixed(8) + ',' + vertex.y.toFixed(8) + ',' + vertex.z.toFixed(8) + '>,\n'
        }
      }
      output = output.slice(0, -2) + '  \n}\n';

      // uvs
      if ( uvs !== undefined ) {
        output += 'uv_vectors {\n  ' + uvs.count + ',\n';
        for ( let i = 0; i < uvs.count; i ++ ) {
          uv.fromBufferAttribute( uvs, i );
          output += '  <' + uv.x.toFixed(8) + ',' + uv.y.toFixed(8) + '>,\n'
        }
        output += '  }\n';
      }

      // normals
      if ( (normals !== undefined) && (!flat_shading) ) {
        output += 'normal_vectors {\n  ' + normals.count + ',\n';
        normalMatrixWorld.getNormalMatrix( mesh.matrixWorld );
        for ( let i = 0; i < normals.count; i ++ ) {
          normal.fromBufferAttribute( normals, i );

          // transform the normal to world space
          normal.applyMatrix3( normalMatrixWorld ).normalize();

          // transform the normal to export format
          // output += 'vn ' + normal.x + ' ' + normal.y + ' ' + normal.z + '\n';
          output += '  <' + normal.x.toFixed(8) + ',' + normal.y.toFixed(8) + ',' + normal.z.toFixed(8) + '>,\n'
        }
        // output += '  }\n';
        output = output.slice(0, -2) + '  \n}\n';
      }

      // texture list
      if ( colors !== undefined && vertex_colors) {
        output += 'texture_list {\n  ' + (colors.count) + ',\n';
        for ( let i = 0; i<colors.count; i++ ) {
          color.fromBufferAttribute( colors, i );
          ColorManagement.fromWorkingColorSpace( color, SRGBColorSpace );
          output += 'texture{pigment{rgb <' + color.r.toFixed(8) + ',' + color.g.toFixed(8) + ',' + color.b.toFixed(8) +'>}}\n'
        }
        output += '}\n';
      }

      // faces
      if ( indices !== null ) {
        output += 'face_indices {\n  ' + (indices.count / 3) + ',\n';
        for ( let i = 0; i < indices.count; i += 3 ) {
          for ( let m = 0; m < 3; m ++ ) {
            const j = indices.getX( i + m );
            face[ m ] = ( j );
          }

          if(reverseVertices)
            output += '  <' + face[2] + ',' + face[1] + ',' + face[0] + '>,';
          else
            output += '  <' + face[0] + ',' + face[1] + ',' + face[2] + '>,';

          if ( colors !== undefined && vertex_colors)
            if(reverseVertices)
              output += ' ' + face[2] + ', ' + face[1] + ', ' + face[0] + ',';
            else
              output += ' ' + face[0] + ', ' + face[1] + ', ' + face[2] + ','; 
          output +=  '\n';
        }
        output = output.slice(0, -2) + '\n}\n';
      }
      output += '}\n';

      // Save POV material name
      materials.push(mesh.userData.povray.material);
    }

    // Header
    const now = new Date();
    output += "//\n// Model file to use with POV-Ray studio environment\n//\n";
    output += "// Source file: " + sourceFile + "\n";
    output += "// Creation time: " + now.getDate() +  "." + (now.getMonth() + 1) + "." + now.getFullYear() + " " +
                          + now.getHours() + ":" + now.getMinutes() + "\n";
    output += "//\n// Prodiced by POV-Ray studio: https://povlab.yesbird.online/studio\n//\n";
    output += "// Download environment: https://povlab.yesbird.online/studio/data/download/studio.zip\n//\n";
    output += "// Author: Yesbird (https://yesbird.online)\n";
    output += "// Date: 15.10.25\n";
    output += "//\n"

    output += "#declare CENTER = <"+ bs.center.x.toFixed(8) + ", " + bs.center.y.toFixed(8) + ", " + bs.center.z.toFixed(8) + ">;\n";
    output += "#declare RADIUS = " + bs.radius.toFixed(8) + ";\n";
    output += "#declare XMIN = " + bb.min.x.toFixed(8) + ";\n";
    output += "#declare XMAX =" + bb.max.x.toFixed(8) + ";\n";
    output += "#declare YMIN =" + bb.min.y.toFixed(8) + ";\n";
    output += "#declare YMAX =" + bb.max.y.toFixed(8) + ";\n";
    output += "#declare ZMIN =" + bb.min.z.toFixed(8) + ";\n";
    output += "#declare ZMAX =" + bb.max.z.toFixed(8) + ";\n\n";

    object.traverse( function ( child ) {
      if ( child.isMesh === true && child.name.substring(0,4) == "part" ) {
        parseMesh( child );
      }
/* Not implement yet
      if ( child.isLine === true ) {
        parseLine( child );
      }

      if ( child.isPoints === true ) {
        parsePoints( child );
      }
*/
    });
    
    // Objects
    object.traverse( function ( child ) {
      if ( child.isMesh === true && child.name.substring(0,4) == "part" ) {
        output += 'object { '+ child.name + '\n         material { ' + child.userData.povray.material + ' }\n}\n';
      }
    })
    return output;
  }
}

export { POVExporter };
