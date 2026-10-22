// Reads the tweak's local diagnostics; does not install a player or make moves.
if(typeof ObjC!=='undefined'&&ObjC.available){
 const manager=ObjC.classes.NSFileManager.defaultManager();
 const folder=manager.URLsForDirectory_inDomains_(13,1).lastObject().path();
 const path=folder.stringByAppendingPathComponent_('LinkedWin.log');
 const log=ObjC.classes.NSString.stringWithContentsOfFile_encoding_error_(path,4,ptr(0));
 if(log)console.log(log.toString());
 else console.log('No LinkedWin diagnostic log found. Install beta3, open LinkedIn and test one game first.');
}else console.log('Run this read-only collector through Frida attached to LinkedIn.');
