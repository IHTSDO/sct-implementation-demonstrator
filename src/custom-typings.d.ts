// Declare ActiveXObject as a type
interface ActiveXObject {
    // Optionally, you can define methods and properties if needed
}
  
// Declare ActiveXObject as a value with a constructor
declare var ActiveXObject: {
    new (typeName: string): ActiveXObject;
};
  